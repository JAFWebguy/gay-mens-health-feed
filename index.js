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

    const limit = 30
    const response = await agent.getTimeline({ limit, cursor })
    
    // Filter posts containing health-related content
    const filteredFeed = response.data.feed
      .filter(item => {
        const postText = item.post.record.text.toLowerCase()
        return healthTopics.some(topic => postText.includes(topic.toLowerCase()))
      })
      .map(item => ({
        post: item.post.uri
      }))

    return {
      cursor: response.data.cursor,
      feed: filteredFeed
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

// Add description endpoint
app.get('/description', (req, res) => {
  res.json({
    did: 'did:web:gay-mens-health-feed-bsky.herokuapp.com',
    displayName: "Gay Men's Health",
    description: "A feed focused on gay men's health topics, including physical health, mental wellness, sexual health, and preventive care.",
    avatar: 'https://example.com/avatar.jpg'
  })
})

app.listen(port, () => {
  console.log(`Gay men's health feed server running on port ${port}`)
})
