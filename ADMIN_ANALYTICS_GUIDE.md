# Admin Analytics Guide

## Accessing Analytics

Navigate to `/admin/analytics` after logging into the admin panel.

## Dashboard Overview

### Summary Statistics

The top section shows key metrics:

- **Total Sessions**: Number of watch sessions in the selected time period
- **Total Watch Time**: Combined time users spent watching content
- **Avg Watch Time**: Average duration per session
- **Completion Rate**: Percentage of sessions where users watched ≥90% of content
- **Avg Completion**: Average percentage of content watched across all sessions
- **Total Pauses**: How many times users paused during playback
- **Total Seeks**: How many times users jumped to different positions
- **Completed**: Number of sessions marked as completed

### Time Range Filters

Select different time periods to analyze:
- **24 Hours**: Last day of activity
- **7 Days**: Last week (default)
- **30 Days**: Last month
- **All Time**: Complete history

### Device Breakdown

Shows distribution of sessions by device type:
- **Desktop**: Traditional computers
- **Mobile**: Smartphones
- **Tablet**: Tablets and iPads
- **TV**: Smart TVs and streaming devices

### Quality Breakdown

Shows distribution of video quality settings:
- **1080p, 720p, 480p, etc.**: Specific quality levels
- **Auto**: Automatic quality selection

### Recent Watch Sessions Table

Detailed view of individual sessions with:

| Column | Description |
|--------|-------------|
| Content | Title and episode info (if TV show) |
| Started | When the session began |
| Duration | Total length of the content |
| Watch Time | How long the user actually watched |
| Completion | Percentage watched (green if completed) |
| Device | Device type used |
| Quality | Video quality setting |
| Pauses | Number of times paused |
| Seeks | Number of position changes |

## Understanding the Metrics

### What is a "Session"?

A session represents one continuous viewing experience. It starts when a user begins watching and ends when they:
- Complete the content (watch ≥90%)
- Close the player
- Navigate away
- Session times out

### Watch Time vs Duration

- **Duration**: Total length of the video/episode
- **Watch Time**: Actual time the user spent watching
- These differ because users may:
  - Skip parts (seeking)
  - Pause and resume
  - Stop before completion

### Completion Percentage

Calculated as: `(Last Position / Duration) × 100`

- **≥90%**: Considered "completed" (shown in green)
- **<90%**: Incomplete session

### Pause Count

Tracks how many times users paused during playback. High pause counts might indicate:
- Engaging content (users taking breaks)
- Interruptions
- Technical issues (buffering)

### Seek Count

Tracks position changes (skipping forward/backward). High seek counts might indicate:
- Users skipping intros/credits
- Looking for specific scenes
- Content not engaging enough

## Use Cases

### Content Performance

**Question**: Which content is most engaging?

**Look at**:
- High completion rates
- Low pause/seek counts
- Long watch times relative to duration

### User Behavior Patterns

**Question**: How do users watch content?

**Look at**:
- Average watch time vs duration
- Pause/seek patterns
- Time of day trends (check Started column)

### Technical Insights

**Question**: What quality do users prefer?

**Look at**:
- Quality breakdown distribution
- Correlation between quality and completion

**Question**: Which devices are most popular?

**Look at**:
- Device breakdown distribution
- Device-specific completion rates

### Engagement Metrics

**Question**: Are users finishing content?

**Look at**:
- Completion rate percentage
- Average completion percentage
- Ratio of completed to total sessions

## Tips for Analysis

### Comparing Time Periods

1. Select "7 Days" to see current week
2. Note the metrics
3. Switch to previous period
4. Compare changes in:
   - Total sessions (growth)
   - Completion rates (engagement)
   - Watch time (usage)

### Identifying Trends

Look for patterns in:
- **Day of week**: When are users most active?
- **Content type**: Movies vs TV shows
- **Session length**: Short vs long form content

### Quality Insights

- High "auto" usage = users trust automatic quality
- Specific quality preferences = users have bandwidth concerns
- Mix of qualities = diverse user base

### Device Insights

- High mobile usage = on-the-go viewing
- High desktop usage = focused watching
- High TV usage = family/group viewing

## Exporting Data

Currently, data is viewable in the dashboard. To export:

1. Use browser developer tools
2. Copy table data
3. Or implement custom export feature

## Privacy & Data

All analytics data is:
- **Anonymized**: No personal information stored
- **Aggregated**: Individual users not identifiable
- **Hashed**: IP addresses are hashed for privacy
- **Secure**: Stored in encrypted database

## Troubleshooting

### No Data Showing

**Possible causes**:
1. No users have watched content yet
2. Time range filter too narrow
3. Database connection issue

**Solutions**:
- Try "All Time" filter
- Check deployment logs
- Verify DATABASE_URL is set

### Incomplete Sessions

**Why sessions might be incomplete**:
- User closed browser/tab
- Network disconnection
- Player error
- User navigated away

This is normal behavior and expected.

### High Seek Counts

**Possible reasons**:
- Users skipping intros/credits
- Looking for specific scenes
- Content pacing issues
- Technical problems (buffering)

Analyze specific content to determine cause.

## Best Practices

1. **Regular Monitoring**: Check analytics weekly
2. **Compare Periods**: Look for trends over time
3. **Content Analysis**: Identify top performers
4. **User Experience**: Use metrics to improve UX
5. **Technical Health**: Monitor for issues

## Future Enhancements

Potential additions:
- Real-time analytics
- Custom date ranges
- Export to CSV/Excel
- Content recommendations
- A/B testing results
- Bandwidth usage tracking
- Geographic distribution
- Peak usage times
- Retention metrics

## Support

For questions or issues:
1. Check deployment logs
2. Review `ANALYTICS_TRACKING.md`
3. Verify environment variables
4. Check database connection
