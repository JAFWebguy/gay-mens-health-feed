const { BskyAgent } = require('@atproto/api')
const express = require('express')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Initialize Bluesky agent
const agent = new BskyAgent({
  service: 'https://bsky.social'
})

// Define health-related keywords and topics
const healthTopics = [
  'mens health',
  'sexual health',
  'mental health',
  'prep',
  'hiv prevention',
  'wellness',
  'healthcare',
  'fitness',
  'nutrition',
  'mental wellness',
  'preventive care'
]

async function getFeedPosts(cursor) {
  try {
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD
    })

    // Algorithm to fetch and filter relevant posts
    // Implementation would include:
    // 1. Fetching recent posts
    // 2. Filtering for health-related content
    // 3. Checking for credible sources
    // 4. Prioritizing posts from health professionals and organizations
    
    return {
      cursor: 'example-cursor',
      feed: [
        // Feed items would go here
      ]
    }
  } catch (error) {
    console.error('Error fetching feed:', error)
    throw error
  }
}

// Feed endpoint
app.get('/', async (req, res) => {
  try {
    const cursor = req.query.cursor
    const feed = await getFeedPosts(cursor)
    res.json(feed)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feed' })
  }
})

app.listen(port, () => {
  console.log(`Gay men's health feed server running on port ${port}`)
})
