/**
 * Test DLHD schedule parsing - verify the new parsing logic
 */

const fetch = require('node-fetch');

// Copy of the parsing functions from the API
function parseEvents(html) {
  const events = [];
  const eventRegex = /<div[^>]*class="[^"]*schedule__event(?:\s[^"]*)?[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*schedule__event(?:\s|")[^"]*"|<\/div>\s*<\/div>\s*<div[^>]*class="[^"]*schedule__category|$)/gi;
  let match;
  let index = 0;

  while ((match = eventRegex.exec(html)) !== null) {
    const eventHtml = match[0];
    
    let time = '';
    let dataTime = '';
    
    const dataTimeMatch = eventHtml.match(/data-time="([^"]*)"/i);
    if (dataTimeMatch) dataTime = dataTimeMatch[1];
    
    const timeMatch = eventHtml.match(/class="[^"]*schedule__time[^"]*"[^>]*>([^<]*)</i);
    if (timeMatch) time = timeMatch[1].trim();
    
    const titleMatch = eventHtml.match(/class="[^"]*schedule__eventTitle[^"]*"[^>]*>([^<]*)</i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Check if live from HTML
    const htmlIndicatesLive = /is-live|class="[^"]*live[^"]*"|>LIVE</i.test(eventHtml);
    const isLive = isEventLive(dataTime, time, htmlIndicatesLive);
    
    // Convert to 12-hour format
    const displayTime = to12HourFormat(time) || time;
    
    const channels = [];
    const channelsSection = eventHtml.match(/class="[^"]*schedule__channels[^"]*"[^>]*>([\s\S]*?)(?:<\/div>|$)/i);
    if (channelsSection) {
      const channelRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
      let chMatch;
      while ((chMatch = channelRegex.exec(channelsSection[1])) !== null) {
        const href = chMatch[1];
        const name = chMatch[2].trim();
        const idMatch = href.match(/id=(\d+)/);
        if (name && name.length > 0) {
          channels.push({ name, channelId: idMatch ? idMatch[1] : '', href });
        }
      }
    }
    
    if (title && title.length > 0) {
      events.push({ id: `event-${index++}`, time: displayTime, dataTime, title, channels, isLive });
    }
  }
  
  return events;
}

function parseCategories(html) {
  // Find all category names and their positions using card__meta divs
  const categoryPositions = [];
  const cardMetaRegex = /<div[^>]*class="card__meta"[^>]*>([^<]+)<\/div>/gi;
  let cardMetaMatch;
  
  while ((cardMetaMatch = cardMetaRegex.exec(html)) !== null) {
    const name = cardMetaMatch[1].trim();
    if (name) {
      categoryPositions.push({
        name,
        index: cardMetaMatch.index
      });
    }
  }
  
  if (categoryPositions.length === 0) {
    return [];
  }
  
  // Parse events for each category section
  const categoryMap = new Map();
  
  for (let i = 0; i < categoryPositions.length; i++) {
    const start = categoryPositions[i].index;
    const end = i < categoryPositions.length - 1 ? categoryPositions[i + 1].index : html.length;
    const catHtml = html.substring(start, end);
    const catName = categoryPositions[i].name;
    
    const events = parseEvents(catHtml);
    events.forEach(e => { e.sport = catName; });
    
    if (events.length > 0) {
      // Merge with existing category if name already exists
      const existing = categoryMap.get(catName);
      if (existing) {
        existing.push(...events);
      } else {
        categoryMap.set(catName, events);
      }
    }
  }
  
  // Convert map to array
  const categories = [];
  for (const [name, events] of categoryMap) {
    categories.push({ name, events });
  }
  
  // Sort by event count
  categories.sort((a, b) => b.events.length - a.events.length);
  
  return categories;
}

// Helper to convert 24h to 12h format
function to12HourFormat(time24) {
  if (!time24) return time24;
  const match = time24.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time24;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Check if event is live (started within last hour)
function isEventLive(dataTime, time24, htmlIndicatesLive) {
  if (htmlIndicatesLive) return true;
  
  try {
    const now = new Date();
    let eventTime = null;
    
    if (time24) {
      const match = time24.match(/^(\d{1,2}):(\d{2})$/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        eventTime = new Date();
        eventTime.setUTCHours(hours, minutes, 0, 0);
      }
    }
    
    if (!eventTime) return false;
    
    const diffMs = now.getTime() - eventTime.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    return diffMinutes >= 0 && diffMinutes <= 60;
  } catch {
    return false;
  }
}

async function testSchedule() {
  console.log('Testing DLHD schedule parsing with 12-hour format and live detection...\n');
  
  try {
    const response = await fetch('https://dlhd.dad/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Referer': 'https://dlhd.dad/'
      }
    });
    
    const html = await response.text();
    console.log('HTML length:', html.length);
    console.log('Current UTC time:', new Date().toUTCString());
    
    // Parse using the new merged approach
    const categories = parseCategories(html);
    
    console.log(`\n=== PARSED ${categories.length} UNIQUE CATEGORIES ===`);
    let totalEvents = 0;
    let liveEvents = 0;
    for (const cat of categories) {
      const catLive = cat.events.filter(e => e.isLive).length;
      console.log(`${cat.name}: ${cat.events.length} events (${catLive} live)`);
      totalEvents += cat.events.length;
      liveEvents += catLive;
    }
    console.log(`\nTOTAL: ${totalEvents} events, ${liveEvents} LIVE`);
    
    // Show sample events with 12-hour format
    console.log('\n=== SAMPLE EVENTS (12-hour format) ===');
    categories.slice(0, 3).forEach(cat => {
      console.log(`\n${cat.name}:`);
      cat.events.slice(0, 5).forEach(e => {
        const liveTag = e.isLive ? ' [LIVE]' : '';
        console.log(`  - ${e.time} ${e.title}${liveTag}`);
      });
    });
    
    // Show all live events
    console.log('\n=== ALL LIVE EVENTS ===');
    let liveCount = 0;
    categories.forEach(cat => {
      cat.events.filter(e => e.isLive).forEach(e => {
        console.log(`  - ${e.time} ${e.title} (${cat.name})`);
        liveCount++;
      });
    });
    console.log(`\nTotal live: ${liveCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSchedule();
