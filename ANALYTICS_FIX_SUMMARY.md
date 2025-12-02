# Analytics System - Complete Guide

## Overview

Your analytics system now has a **single source of truth** for all metrics, plus a new **Insights** page for visualizing user activity and proving usage.

## New Features

### 📊 Insights Page (`/admin/insights`)

A comprehensive dashboard showing:

1. **Verified User Metrics** - Big, clear numbers proving your user base
   - Total Unique Users (all time)
   - Daily Active Users (DAU - 24h)
   - Weekly Active Users (WAU - 7d)
   - Monthly Active Users (MAU - 30d)
   - Currently Online (real-time)
   - Countries reached

2. **Geographic Visualization** - Where users are viewing from
   - Country breakdown with flags
   - Percentage distribution
   - Top 8 countries displayed

3. **Device Distribution** - Pie chart showing desktop/mobile/tablet split

4. **Activity Patterns** - Heatmap showing peak usage hours by day

5. **User Growth Trend** - Daily chart showing user growth and new users

6. **Traffic Sources** - Where users are coming from (Direct, Google, Reddit, etc.)

7. **Export Functionality** - Download CSV or JSON proof of your analytics

## Metric Definitions

| Metric | Source | Time Range | Description |
|--------|--------|------------|-------------|
| **Live Users** | `live_activity` | 5 min | Unique users currently active |
| **Total Users** | `user_activity` | All time | Total unique users ever |
| **DAU** | `user_activity` | 24h | Unique users active today |
| **WAU** | `user_activity` | 7 days | Unique users active this week |
| **MAU** | `user_activity` | 30 days | Unique users active this month |
| **New Users** | `user_activity` | 24h | First-time users today |
| **Returning** | `user_activity` | 24h | Users who came back today |
| **Sessions** | `watch_sessions` | 24h | Watch sessions started |
| **Watch Time** | `watch_sessions` | 24h | Total minutes watched |
| **Page Views** | `analytics_events` | 24h | Total page views |
| **Geographic** | `user_activity` | 7 days | Users per country |
| **Devices** | `user_activity` | 7 days | Users per device type |

## Key Technical Changes

### 1. Unified Stats API (`/api/admin/unified-stats`)
- All queries use `COUNT(DISTINCT user_id)` - no duplicate counting
- Validates timestamps (must be after Jan 1, 2020)
- Returns time ranges for transparency

### 2. Insights API (`/api/admin/insights`)
- Hourly activity patterns
- Daily user trends with new vs returning
- Traffic source/referrer analysis

### 3. StatsContext
- Single source of truth for all admin pages
- Auto-refreshes every 30 seconds
- Includes page views and unique visitors

## How to Use

1. **Navigate to `/admin/insights`** for the full visualization dashboard
2. **Use the time range selector** (24h, 7d, 30d) to adjust the view
3. **Export data** using the CSV or JSON buttons for proof of usage
4. **All other admin pages** now show consistent numbers from the same source

## Verifying Data Accuracy

Your numbers should follow these logical relationships:
- `Live Users` ≤ `DAU` ≤ `WAU` ≤ `MAU` ≤ `Total Users`
- `New Users Today` + `Returning Users` ≈ `DAU`
- Geographic totals should roughly match WAU

## Database Tables

- `live_activity` - Real-time heartbeats (5 min window)
- `user_activity` - User session history
- `watch_sessions` - Content viewing data
- `analytics_events` - Page views and events
- `page_views` - Detailed page view tracking
