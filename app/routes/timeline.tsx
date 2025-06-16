import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useLocation } from "@remix-run/react";
import { Clock, ChevronRight, Home } from "lucide-react";
import TimeToShadowTimeline from "~/components/TimeToShadowTimeline";
import { mockTimelineSummary, mockTimelineEvents } from "~/lib/iam/mock-timeline-data";
import type { ShadowTimelineEvent, TimelineSummary } from "~/lib/iam/time-to-shadow-timeline";

interface LoaderData {
  summary: TimelineSummary;
  timeline: ShadowTimelineEvent[];
  error?: string;
  isMockData?: boolean;
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Get the cookie header from the original request
    const cookieHeader = request.headers.get("Cookie");
    
    // Fetch timeline data from API
    const response = await fetch(`${baseUrl}/api/timeline`, {
      headers: {
        Cookie: cookieHeader || "",
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return json<LoaderData>({
        summary: data.data.summary,
        timeline: data.data.timeline,
        isMockData: data.isMockData || false
      });
    } else {
      // Fallback to mock data on API error
      console.log('API failed, using mock timeline data');
      return json<LoaderData>({
        summary: mockTimelineSummary,
        timeline: mockTimelineEvents,
        isMockData: true,
        error: "Using demo data - API unavailable"
      });
    }
  } catch (error) {
    console.error('Timeline loader error:', error);
    // Fallback to mock data on any error
    return json<LoaderData>({
      summary: mockTimelineSummary,
      timeline: mockTimelineEvents,
      isMockData: true,
      error: "Using demo data due to connection error"
    });
  }
};

export default function TimelinePage() {
  const { summary, timeline, error, isMockData } = useLoaderData<LoaderData>();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#1A1D24] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header with Breadcrumb */}
        <div className="mb-8">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm text-gray-400 mb-4">
            <Link 
              to="/" 
              className="flex items-center hover:text-white transition-colors duration-200"
            >
              <Home className="w-4 h-4 mr-1" />
              Dashboard
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </span>
          </nav>

          {/* Page Title and Description */}
          <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Time-to-Shadow Timeline</h1>
                  <p className="text-gray-300 text-lg">
                    Predictive analysis of when permissions may become shadow risks
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Timeline Content */}
        <TimeToShadowTimeline 
          initialData={{
            summary,
            timeline
          }}
        />
        
        {/* Error notice for mock data */}
        {error && isMockData && (
          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-yellow-400">Demo Mode</h3>
                <p className="text-sm text-yellow-300 mt-1">
                  {error}. The timeline is showing sample data to demonstrate the feature functionality.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 