import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REPORT_SECRET = Deno.env.get('REPORT_SECRET') || ''
const REPORT_TO_EMAIL = Deno.env.get('REPORT_TO_EMAIL') || 'smita.kulkarni89@gmail.com'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  // Verify secret header for security
  const secret = req.headers.get('x-report-secret')
  if (REPORT_SECRET && secret !== REPORT_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Create Supabase client with service role key (can read events table)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Calculate date range for last 7 days
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString()

    // Query 1: New users (anon_id first seen in last 7 days)
    const { data: firstSeenData, error: firstSeenError } = await supabase
      .from('leafnote_events')
      .select('anon_id, created_at')
      .order('created_at', { ascending: true })

    if (firstSeenError) throw firstSeenError

    // Find first occurrence of each anon_id
    const firstSeen = new Map()
    for (const row of firstSeenData || []) {
      if (!firstSeen.has(row.anon_id)) {
        firstSeen.set(row.anon_id, new Date(row.created_at))
      }
    }

    const newUsers = Array.from(firstSeen.entries()).filter(
      ([_, firstSeenAt]) => firstSeenAt >= sevenDaysAgo
    )
    const newUsersCount = newUsers.length

    // Query 2: Repeat users (active in last 7 days AND had activity before 7 days ago)
    const { data: allEvents, error: allEventsError } = await supabase
      .from('leafnote_events')
      .select('anon_id, created_at')

    if (allEventsError) throw allEventsError

    const userActivity = new Map()
    for (const row of allEvents || []) {
      const anonId = row.anon_id
      const createdAt = new Date(row.created_at)
      
      if (!userActivity.has(anonId)) {
        userActivity.set(anonId, { recentActivity: false, oldActivity: false })
      }
      
      const activity = userActivity.get(anonId)
      if (createdAt >= sevenDaysAgo) {
        activity.recentActivity = true
      } else {
        activity.oldActivity = true
      }
    }

    const repeatUsers = Array.from(userActivity.entries()).filter(
      ([_, activity]) => activity.recentActivity && activity.oldActivity
    )
    const repeatUsersCount = repeatUsers.length

    // Query 3: Add Read clicks in last 7 days
    const { data: addReadClicks, error: addReadError } = await supabase
      .from('leafnote_events')
      .select('*')
      .eq('event_name', 'add_read_click')
      .gte('created_at', sevenDaysAgoStr)

    if (addReadError) throw addReadError
    const addReadClicksCount = addReadClicks?.length || 0

    // Query 4: Add To-Read clicks in last 7 days
    const { data: addToReadClicks, error: addToReadError } = await supabase
      .from('leafnote_events')
      .select('*')
      .eq('event_name', 'add_toread_click')
      .gte('created_at', sevenDaysAgoStr)

    if (addToReadError) throw addToReadError
    const addToReadClicksCount = addToReadClicks?.length || 0

    // Query 5: Per-user engagement data for last 7 days
    const { data: recentEvents, error: recentError } = await supabase
      .from('leafnote_events')
      .select('*')
      .gte('created_at', sevenDaysAgoStr)

    if (recentError) throw recentError

    const userEngagement = new Map()
    for (const event of recentEvents || []) {
      const key = event.anon_id
      if (!userEngagement.has(key)) {
        userEngagement.set(key, {
          anon_id: event.anon_id,
          user_id: event.user_id || '',
          first_seen: firstSeen.get(event.anon_id)?.toISOString() || '',
          last_seen: event.created_at,
          total_events_7d: 0,
          add_read_clicks_7d: 0,
          add_toread_clicks_7d: 0,
        })
      }
      
      const user = userEngagement.get(key)
      user.total_events_7d++
      if (event.event_name === 'add_read_click') user.add_read_clicks_7d++
      if (event.event_name === 'add_toread_click') user.add_toread_clicks_7d++
      
      // Update last_seen if this event is more recent
      if (new Date(event.created_at) > new Date(user.last_seen)) {
        user.last_seen = event.created_at
      }
    }

    // Query 6: Book activity (titles added in last 7 days with counts and avg ratings)
    const bookActivity = new Map()
    for (const event of recentEvents || []) {
      if (event.event_name === 'add_read_success' || event.event_name === 'add_toread_success') {
        const title = event.book_title || 'Unknown'
        const author = event.book_author || 'Unknown'
        const status = event.book_status || 'unknown'
        const key = `${title}|||${author}|||${status}`
        
        if (!bookActivity.has(key)) {
          bookActivity.set(key, {
            title,
            author,
            status,
            count_added_7d: 0,
            total_rating: 0,
            rating_count: 0,
          })
        }
        
        const book = bookActivity.get(key)
        book.count_added_7d++
        if (event.book_rating) {
          book.total_rating += event.book_rating
          book.rating_count++
        }
      }
    }

    // Generate CSV content for user engagement
    const userCsvRows = [
      'anon_id,user_id,first_seen,last_seen,total_events_7d,add_read_clicks_7d,add_toread_clicks_7d'
    ]
    for (const user of Array.from(userEngagement.values())) {
      userCsvRows.push(
        `"${user.anon_id}","${user.user_id}","${user.first_seen}","${user.last_seen}",${user.total_events_7d},${user.add_read_clicks_7d},${user.add_toread_clicks_7d}`
      )
    }
    const userCsv = userCsvRows.join('\n')

    // Generate CSV content for book activity
    const bookCsvRows = [
      'title,author,status,count_added_7d,avg_rating_7d'
    ]
    for (const book of Array.from(bookActivity.values())) {
      const avgRating = book.rating_count > 0 ? (book.total_rating / book.rating_count).toFixed(1) : 'N/A'
      bookCsvRows.push(
        `"${book.title}","${book.author}","${book.status}",${book.count_added_7d},"${avgRating}"`
      )
    }
    const bookCsv = bookCsvRows.join('\n')

    // Combine CSVs (simple approach: concatenate with section headers)
    const combinedCsv = `USER ENGAGEMENT (Last 7 Days)\n${userCsv}\n\nBOOK ACTIVITY (Last 7 Days)\n${bookCsv}`

    // Send email via Resend
    const emailSubject = `Leafnote Weekly Engagement Report (${now.toISOString().split('T')[0]})`
    const emailBody = `
Leafnote Weekly Engagement Report
==================================
Report generated: ${now.toISOString()}
Period: Last 7 days (${sevenDaysAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]})

SUMMARY METRICS:
- New users: ${newUsersCount}
- Repeat users: ${repeatUsersCount}
- Add Read clicks: ${addReadClicksCount}
- Add To-Read clicks: ${addToReadClicksCount}

See attached CSV for detailed user engagement and book activity data.

---
Leafnote Analytics
    `.trim()

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set - skipping email send')
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'Report generated (email not sent - no API key)',
          summary: {
            newUsers: newUsersCount,
            repeatUsers: repeatUsersCount,
            addReadClicks: addReadClicksCount,
            addToReadClicks: addToReadClicksCount,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Leafnote Analytics <onboarding@resend.dev>',
        to: [REPORT_TO_EMAIL],
        subject: emailSubject,
        text: emailBody,
        attachments: [
          {
            filename: 'leafnote_weekly_report.csv',
            content: btoa(combinedCsv),
          },
        ],
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Weekly report sent successfully',
        summary: {
          newUsers: newUsersCount,
          repeatUsers: repeatUsersCount,
          addReadClicks: addReadClicksCount,
          addToReadClicks: addToReadClicksCount,
        },
        emailId: resendData.id,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating weekly report:', error)
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
