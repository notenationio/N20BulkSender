/** @type {import("pliny/config").PlinyConfig } */
const siteMetadata = {
  title: 'N20 Token Bulk Sender',
  author: 'NoteNation.io',
  headerTitle: 'Bulk Sender',
  description: 'Send N20 tokens to multiple addresses',
  language: 'en-us',
  theme: 'system', // system, dark or light
  siteUrl: 'https://your-site.com',
  siteRepo: 'https://github.com/notenationio/N20BulkSender',
  socialBanner: '/static/images/twitter-card.png',
  email: 'address@yoursite.com',
  github: 'https://github.com/notenationio/N20BulkSender',
  x: 'https://twitter.com/x',
  facebook: 'https://facebook.com',
  youtube: 'https://youtube.com',
  locale: 'en-US',
  analytics: {
    // If you want to use an analytics provider you have to add it to the
    // content security policy in the `next.config.js` file.
    // supports Plausible, Simple Analytics, Umami, Posthog or Google Analytics.
    umamiAnalytics: {
      // We use an env variable for this site to avoid other users cloning our analytics ID
      umamiWebsiteId: process.env.NEXT_UMAMI_ID, // e.g. 123e4567-e89b-12d3-a456-426614174000
      // You may also need to overwrite the script if you're storing data in the US - ex:
      // src: 'https://us.umami.is/script.js'
      // Remember to add 'us.umami.is' in `next.config.js` as a permitted domain for the CSP
    },
  },
}

module.exports = siteMetadata
