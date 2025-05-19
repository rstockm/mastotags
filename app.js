import {
    rateLimiter,
    sanitizeInput,
    validateHashtag,
    secureApiCall,
    csrfToken,
    csp
} from './security.js';

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchTerm = document.getElementById('search-term');
    const resultsContainer = document.getElementById('results-container');
    const hashtagsList = document.getElementById('hashtags-list');
    const loadingIndicator = document.getElementById('loading');
    let spinner = loadingIndicator.querySelector('.spinner-border');
    const errorMessage = document.getElementById('error-message');
    const createMastowallBtn = document.getElementById('create-mastowall-btn');

    // Set CSRF token
    const token = csrfToken.set();
    document.querySelector('meta[name="csrf-token"]').content = token;

    // Mastodon API Endpunkte
    const MASTODON_INSTANCE = 'https://mastodon.social';
    const PUBLIC_TIMELINE_API = `${MASTODON_INSTANCE}/api/v1/timelines/public`;
    const TAG_TIMELINE_API = `${MASTODON_INSTANCE}/api/v1/timelines/tag`;
    const SEARCH_API = `${MASTODON_INSTANCE}/api/v2/search`;

    // Settings for extended search
    const MAX_RELATED_HASHTAGS = 5;
    const MAX_DEPTH = 1; // Depth of recursive search
    const MAX_SELECTED_HASHTAGS = 3; // Maximum number of selected hashtags
    
    // Array for selected hashtags
    let selectedHashtags = [];

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const query = searchTerm.value.trim();
        if (!query) return;

        // Validate input
        if (!validateHashtag(query)) {
            showError('Invalid hashtag format. Please use only letters, numbers, and underscores.');
            return;
        }

        // Check rate limiting
        if (!rateLimiter.isAllowed(window.location.hostname)) {
            showError('Too many requests. Please wait a moment.');
            return;
        }

        // Reset UI
        hashtagsList.innerHTML = '';
        errorMessage.classList.add('d-none');
        resultsContainer.classList.remove('d-none');
        
        // Create fresh spinner element to ensure animation works
        const oldSpinner = spinner;
        const newSpinner = oldSpinner.cloneNode(true);
        oldSpinner.parentNode.replaceChild(newSpinner, oldSpinner);
        spinner = newSpinner; // Update the reference to the new spinner
        
        // Show loading indicator
        loadingIndicator.classList.remove('d-none');
        
        selectedHashtags = [];
        updateMastowallButton();

        try {
            const hashtags = await findRelatedHashtagsExtended(query);
            displayHashtags(hashtags);
        } catch (error) {
            console.error('Search error:', error);
            showError(error.message || 'An error occurred.');
        } finally {
            loadingIndicator.classList.add('d-none');
        }
    });

    // Main function: Performs an extended search with aggregation of results
    async function findRelatedHashtagsExtended(query) {
        // Get initial results for the main search term and capture all found toots
        const { hashtags: primaryResults, tootsMap: initialTootsMap } = await searchSingleHashtag(query, true);
        
        if (primaryResults.length === 0) {
            throw new Error(`No hashtags found for "${query}".`);
        }

        // Find the top hashtags from the primary results
        const topRelatedTags = primaryResults
            .slice(0, MAX_RELATED_HASHTAGS)
            .map(tag => tag.name);
        
        console.log(`Top related hashtags for '${query}': ${topRelatedTags.join(', ')}`);
        
        // Perform a search for each top hashtag
        const allResults = [...primaryResults]; // Results from the main search term
        const processedTags = new Set([query.toLowerCase().replace(/^#/, '')]);
        
        // Start with the initial toots map for cross-function deduplication
        const tootsMap = initialTootsMap;
        
        // Secondary searches for each of the top hashtags
        for (const relatedTag of topRelatedTags) {
            // Don't search the same hashtags multiple times
            if (processedTags.has(relatedTag.toLowerCase())) {
                continue;
            }
            
            processedTags.add(relatedTag.toLowerCase());
            
            try {
                console.log(`Searching for related hashtags for #${relatedTag}...`);
                const tagResponse = await fetch(`${TAG_TIMELINE_API}/${relatedTag}?limit=30`);
                
                if (tagResponse.ok) {
                    const tagToots = await tagResponse.json();
                    // Add toots to the map using ID as key to avoid duplicates
                    tagToots.forEach(toot => {
                        if (!tootsMap.has(toot.id)) {
                            tootsMap.set(toot.id, toot);
                        }
                    });
                }
            } catch (error) {
                console.warn(`Error retrieving #${relatedTag}:`, error);
            }
        }
        
        // Convert the Map to an array of unique toots
        const uniqueToots = Array.from(tootsMap.values());
        console.log(`Found ${uniqueToots.length} unique toots after deduplication across all searches`);
        
        // Extract all hashtags from the collected toots
        const hashtagCounts = {};
        
        uniqueToots.forEach(toot => {
            if (toot.tags && Array.isArray(toot.tags)) {
                toot.tags.forEach(tag => {
                    const name = tag.name.toLowerCase();
                    hashtagCounts[name] = (hashtagCounts[name] || 0) + 1;
                });
            }
        });

        // Convert to array and sort by frequency
        const sortedHashtags = Object.entries(hashtagCounts)
            .map(([name, count]) => ({ 
                name, 
                count,
                // Mark the original search term, but don't change the sorting
                isOriginal: name.toLowerCase() === query.toLowerCase().replace(/^#/, '')
            }))
            .filter(tag => tag.count > 1 || tag.isOriginal) // Hashtags mit nur einem Treffer entfernen, außer es ist der ursprüngliche Suchbegriff
            .sort((a, b) => b.count - a.count);
        
        return sortedHashtags;
    }

    // Helper function: Performs a single hashtag search
    // returnToots parameter determines whether to return the toots map for deduplication
    async function searchSingleHashtag(query, returnToots = false) {
        // Input sanitization
        query = sanitizeInput(query);
        
        let searchResults;
        try {
            const searchResponse = await secureApiCall(
                `${SEARCH_API}?q=${encodeURIComponent(query)}&type=hashtags&limit=5`,
                {
                    headers: {
                        'X-CSRF-Token': token
                    }
                }
            );
            searchResults = await searchResponse.json();
        } catch (error) {
            console.warn('Hashtag search failed:', error);
            searchResults = { hashtags: [] };
        }

        // Step 2: Collect toots from various sources - use a Map to deduplicate by ID
        const tootsMap = new Map();
        
        // 2a: If hashtags were found, get their timelines
        const foundHashtags = searchResults.hashtags || [];
        for (const tag of foundHashtags.slice(0, 3)) { // Limit to the first 3
            try {
                const tagResponse = await fetch(`${TAG_TIMELINE_API}/${tag.name}?limit=30`);
                if (tagResponse.ok) {
                    const tagToots = await tagResponse.json();
                    // Add toots to the map using ID as key to avoid duplicates
                    tagToots.forEach(toot => {
                        if (!tootsMap.has(toot.id)) {
                            tootsMap.set(toot.id, toot);
                        }
                    });
                }
            } catch (error) {
                console.warn(`Error retrieving hashtag #${tag.name}:`, error);
            }
        }
        
        // 2b: Also search in the public timeline
        try {
            const publicResponse = await fetch(`${PUBLIC_TIMELINE_API}?limit=40`);
            if (publicResponse.ok) {
                const publicToots = await publicResponse.json();
                
                // Only add toots that contain the search term (in content or hashtags)
                const relevantPublicToots = publicToots.filter(toot => {
                    // Check content
                    if (toot.content.toLowerCase().includes(query.toLowerCase())) {
                        return true;
                    }
                    
                    // Check hashtags
                    if (toot.tags && Array.isArray(toot.tags)) {
                        return toot.tags.some(tag => 
                            tag.name.toLowerCase().includes(query.toLowerCase())
                        );
                    }
                    
                    return false;
                });
                
                // Add relevant toots to the map, avoiding duplicates
                relevantPublicToots.forEach(toot => {
                    if (!tootsMap.has(toot.id)) {
                        tootsMap.set(toot.id, toot);
                    }
                });
            }
        } catch (error) {
            console.warn('Error retrieving public timeline:', error);
        }

        // Convert the Map to an array of unique toots
        const uniqueToots = Array.from(tootsMap.values());
        console.log(`Found ${uniqueToots.length} unique toots in single hashtag search`);
        
        // If no results were found
        if (uniqueToots.length === 0) {
            return returnToots ? { hashtags: [], tootsMap } : [];
        }

        // Step 3: Extract all hashtags from the found toots
        const hashtagCounts = {};
        
        uniqueToots.forEach(toot => {
            if (toot.tags && Array.isArray(toot.tags)) {
                toot.tags.forEach(tag => {
                    const name = tag.name.toLowerCase();
                    hashtagCounts[name] = (hashtagCounts[name] || 0) + 1;
                });
            }
        });

        // Convert to array and sort by frequency
        const sortedHashtags = Object.entries(hashtagCounts)
            .map(([name, count]) => ({ 
                name, 
                count,
                // Mark the original search term, but don't change the sorting
                isOriginal: name.toLowerCase() === query.toLowerCase().replace(/^#/, '')
            }))
            .filter(tag => tag.count > 1 || tag.isOriginal) // Hashtags mit nur einem Treffer entfernen, außer es ist der ursprüngliche Suchbegriff
            .sort((a, b) => b.count - a.count);

        return returnToots ? { hashtags: sortedHashtags, tootsMap } : sortedHashtags;
    }

    function displayHashtags(hashtags) {
        if (hashtags.length === 0) {
            showError('No related hashtags found.');
            return;
        }

        const maxCount = hashtags[0].count;

        hashtags.forEach((tag, index) => {
            // Sanitize tag name
            const sanitizedName = sanitizeInput(tag.name);
            
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item hashtag-card';
            
            // Determine popularity class
            if (tag.isOriginal) {
                listItem.classList.add('popularity-original');
            } else if (tag.count >= maxCount * 0.7) {
                listItem.classList.add('popularity-high');
            } else if (tag.count >= maxCount * 0.3) {
                listItem.classList.add('popularity-medium');
            } else {
                listItem.classList.add('popularity-low');
            }

            // Container for all elements in one row
            const contentDiv = document.createElement('div');
            contentDiv.className = 'hashtag-content d-flex align-items-center';
            
            // 1. Hashtag as link to Mastowall
            const hashtagLink = document.createElement('a');
            hashtagLink.className = 'hashtag-name me-3';
            hashtagLink.href = `https://rstockm.github.io/mastowall/?hashtags=${sanitizedName}&server=https://mastodon.social`;
            hashtagLink.target = '_blank';
            hashtagLink.rel = 'noopener noreferrer';
            hashtagLink.textContent = `#${sanitizedName}`;
            
            // Stop event propagation for the link
            hashtagLink.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // 2. Progress bar in the middle with flex-grow
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress';
            
            const progressBarInner = document.createElement('div');
            progressBarInner.className = 'progress-bar';
            
            // Calculate percentage for bar length
            const percentage = (tag.count / maxCount) * 100;
            
            // Bar color based on popularity
            if (tag.isOriginal) {
                progressBarInner.classList.add('bg-primary');
            } else if (tag.count >= maxCount * 0.7) {
                progressBarInner.classList.add('bg-success');
            } else if (tag.count >= maxCount * 0.3) {
                progressBarInner.classList.add('bg-warning');
            } else {
                progressBarInner.classList.add('bg-secondary');
            }
            
            progressBarInner.style.width = `${percentage}%`;
            progressBarInner.setAttribute('aria-valuenow', percentage);
            progressBarInner.setAttribute('aria-valuemin', 0);
            progressBarInner.setAttribute('aria-valuemax', 100);
            
            progressBar.appendChild(progressBarInner);
            progressContainer.appendChild(progressBar);
            
            // 3. Count of occurrences
            const count = document.createElement('span');
            count.className = 'hashtag-count ms-3 me-4';
            count.textContent = tag.count;
            
            // 4. Checkbox for selection
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input hashtag-checkbox';
            checkbox.id = `hashtag-${sanitizedName}`;
            checkbox.value = sanitizedName;
            
            // Select the first three hashtags by default
            if (index < MAX_SELECTED_HASHTAGS) {
                checkbox.checked = true;
                selectedHashtags.push(sanitizedName);
            }
            
            checkbox.addEventListener('change', function() {
                handleHashtagSelection(this);
            });
            
            // Stop event propagation for the checkbox
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            checkboxContainer.appendChild(checkbox);
            
            // Assemble all elements
            contentDiv.appendChild(hashtagLink);
            contentDiv.appendChild(progressContainer);
            contentDiv.appendChild(count);
            contentDiv.appendChild(checkboxContainer);
            listItem.appendChild(contentDiv);
            
            // Make entire row clickable
            listItem.style.cursor = 'pointer';
            listItem.addEventListener('click', () => {
                // Toggle checkbox
                checkbox.checked = !checkbox.checked;
                // Trigger event
                const changeEvent = new Event('change');
                checkbox.dispatchEvent(changeEvent);
            });
            
            hashtagsList.appendChild(listItem);
        });
        
        // Update Mastowall button after loading hashtags
        updateMastowallButton();
    }
    
    // Function to manage hashtag selection (max 3)
    function handleHashtagSelection(checkbox) {
        const hashtag = checkbox.value;
        
        if (checkbox.checked) {
            // Check if 3 hashtags are already selected
            if (selectedHashtags.length >= MAX_SELECTED_HASHTAGS) {
                // Show warning
                alert(`You can select a maximum of ${MAX_SELECTED_HASHTAGS} hashtags. Please deselect another hashtag first.`);
                
                // Uncheck the checkbox
                checkbox.checked = false;
                return;
            }
            
            // Add hashtag to the list
            selectedHashtags.push(hashtag);
        } else {
            // Remove hashtag from the list
            const index = selectedHashtags.indexOf(hashtag);
            if (index !== -1) {
                selectedHashtags.splice(index, 1);
            }
        }
        
        // Update button status
        updateMastowallButton();
    }
    
    // Function to update the Mastowall button
    function updateMastowallButton() {
        if (createMastowallBtn) {
            if (selectedHashtags.length > 0) {
                createMastowallBtn.classList.remove('disabled');
                createMastowallBtn.setAttribute('aria-disabled', 'false');
            } else {
                createMastowallBtn.classList.add('disabled');
                createMastowallBtn.setAttribute('aria-disabled', 'true');
            }
            
            // Update URL for the button
            const hashtagsParam = selectedHashtags.join(',');
            createMastowallBtn.href = `https://rstockm.github.io/mastowall/?hashtags=${hashtagsParam}&server=https://mastodon.social`;
        }
    }
    
    // Event listener for the "Create Mastowall" button
    if (createMastowallBtn) {
        createMastowallBtn.addEventListener('click', function(e) {
            if (selectedHashtags.length === 0) {
                e.preventDefault();
                alert('Please select at least one hashtag.');
            }
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
        resultsContainer.classList.add('d-none');
    }
}); 
