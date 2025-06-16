import { json } from "@remix-run/node";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { TimeToShadowTimeline } from "~/lib/iam/time-to-shadow-timeline";
import { mockTimelineSummary, mockTimelineEvents } from "~/lib/iam/mock-timeline-data";
import type { UserDetails, RoleDetails } from "~/lib/iam/types";

// Helper function to fetch users and roles from existing API endpoints
async function fetchEntitiesData(): Promise<{ users: UserDetails[], roles: RoleDetails[] }> {
  try {
    // Fetch from the entities API endpoint
    const response = await fetch('/api/entities');
    if (!response.ok) {
      throw new Error('Failed to fetch entities data');
    }
    
    const data = await response.json();
    return {
      users: data.users || [],
      roles: data.roles || []
    };
  } catch (error) {
    console.error('Error fetching entities data:', error);
    return { users: [], roles: [] };
  }
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get users and roles data
    const { users, roles } = await fetchEntitiesData();

    // If we have real data, use the timeline engine
    if (users.length > 0 || roles.length > 0) {
      const timeline = new TimeToShadowTimeline(users, roles);
      const summary = timeline.getTimelineSummary();

      return json({
        success: true,
        data: {
          summary,
          timeline: summary.timelineEvents
        }
      });
    } else {
      // Use mock data when no real data is available
      console.log('Using mock timeline data - no real entities found');
      return json({
        success: true,
        data: {
          summary: mockTimelineSummary,
          timeline: mockTimelineEvents
        },
        isMockData: true
      });
    }
  } catch (error) {
    console.error('Timeline API Error:', error);
    
    // Fallback to mock data on error
    console.log('Falling back to mock timeline data due to error');
    return json({
      success: true,
      data: {
        summary: mockTimelineSummary,
        timeline: mockTimelineEvents
      },
      isMockData: true,
      error: 'Using mock data due to API error'
    });
  }
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const formData = await request.formData();
    const action = formData.get('action') as string;

    switch (action) {
      case 'get_events_by_severity': {
        const severity = formData.get('severity') as 'low' | 'medium' | 'high' | 'critical';
        
        // Try to get real data first
        const { users, roles } = await fetchEntitiesData();
        
        if (users.length > 0 || roles.length > 0) {
          const timeline = new TimeToShadowTimeline(users, roles);
          const events = timeline.getEventsBySeverity(severity);
          
          return json({
            success: true,
            data: events
          });
        } else {
          // Use mock data filtered by severity
          const events = mockTimelineEvents.filter(event => event.severity === severity);
          
          return json({
            success: true,
            data: events,
            isMockData: true
          });
        }
      }

      case 'get_upcoming_events': {
        const days = parseInt(formData.get('days') as string) || 30;
        
        // Try to get real data first
        const { users, roles } = await fetchEntitiesData();
        
        if (users.length > 0 || roles.length > 0) {
          const timeline = new TimeToShadowTimeline(users, roles);
          const events = timeline.getUpcomingEvents(days);
          
          return json({
            success: true,
            data: events
          });
        } else {
          // Use mock data filtered by timeframe
          const now = new Date();
          const cutoffDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          const events = mockTimelineEvents.filter(event => event.estimatedDate <= cutoffDate);
          
          return json({
            success: true,
            data: events,
            isMockData: true
          });
        }
      }

      default:
        return json(
          { 
            success: false, 
            error: 'Invalid action' 
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Timeline API Action Error:', error);
    
    // Fallback to mock data on error
    return json(
      { 
        success: true,
        data: mockTimelineEvents,
        isMockData: true,
        error: 'Using mock data due to API error'
      }
    );
  }
}; 