# Mastotags 1.1

Mastotags is a web service that helps you find the most popular hashtags for current events, topics, or trending discussions on Mastodon. This tool simplifies the process of discovering which hashtags have the greatest reach for any given topic.

Give it a try:

https://rstockm.github.io/mastotags/

<img width="1770" height="1480" alt="image" src="https://github.com/user-attachments/assets/6bbc84a0-b718-4068-af20-b57dfb8fcf57" />


## Features

- **Smart Hashtag Search**: Enter any topic, event name, or existing hashtag to discover related tags
- **Popularity Analysis**: See which hashtags are most frequently used based on real Mastodon data
- **Visual Metrics**: Clear visual representation of hashtag popularity with color-coded bars
- **Integrated with Mastowall**: Select up to three hashtags to view associated posts on Mastowall
- **No Authentication Required**: Works without Mastodon login or API tokens
- **URL Parameter Support**: Search directly via URL parameters for easy sharing and bookmarking
- **Share Search Results**: Copy a direct link to your current search results
 - **Automatic Variant Suggestion (1.1)**: When users enter a variant like "Koln", Mastotags samples real posts and automatically switches to the most used exact hashtag variant (e.g., "Köln") and then performs a strict search. Counts remain strict; no merging across variants.

## How It Works

1. **Extended Search Algorithm**: 
   - First-level search based on your query term
   - Secondary search analyzing the top related hashtags
   - Results aggregation for robust recommendations

2. **Data Visualization**:
   - Linear scaling of popularity bars
   - Color-coding by popularity (very popular, moderate, less common)
   - Original search term highlighted for reference

3. **Mastowall Integration**:
   - Click any hashtag to view its Mastowall directly
   - Select up to three hashtags for combined viewing
   - One-click generation of custom Mastowall links

4. **URL Features**:
   - Direct search via URL: `?q=topic`, `?search=topic`, or `?hashtag=topic`
   - Dynamic URL updates reflecting your current search without page reloads
   - Copy URL button to easily share your search results

## What’s New in 1.1

- Strict Unicode handling for hashtags (e.g., `#Köln`) without mixing with normalized forms
- Exact-count detection by scanning toot fulltexts for the exact hashtag spelling
- Automatic variant suggestion: detects the most common exact variant (from real posts) matching the folded form of the query and reruns the search strictly with that variant

## Technology

- **Frontend**: HTML, CSS, JavaScript with Bootstrap 5
- **Data Source**: Public Mastodon API endpoints from mastodon.social
- **No Backend Required**: All processing happens in the browser

## Local Development

1. Clone the repository:
   ```
   git clone https://github.com/rstockm/mastotags.git
   cd mastotags
   ```

2. Start a local server:
   ```
   # Python 3
   python -m http.server 8000
   
   # Or with Node.js
   npx serve
   ```

3. Open in your browser: http://localhost:8000

4. Test URL parameters:
   ```
   https://rstockm.github.io/mastotags/?q=mastodon
   https://rstockm.github.io/mastotags/?search=mastowall
   https://rstockm.github.io/mastotags/?hashtag=apple
   ```

## Deployment

The application is designed to be hosted on GitHub Pages or any static file hosting service. No server-side processing is required.

## Notes

- The service uses only public API endpoints without authentication
- Only public toots are analyzed
- Results are based on the most recent available toots
- Limited to the first 40 toots per search due to API constraints
- URL parameters make sharing specific searches easy and efficient

## Related Projects

- [Mastowall](https://github.com/rstockm/mastowall): Display Mastodon posts with specific hashtags

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
