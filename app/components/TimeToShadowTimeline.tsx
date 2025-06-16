import { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  ChevronUp,
  Filter,
  RefreshCw,
  TestTube
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { ShadowTimelineEvent, TimelineSummary } from "~/lib/iam/time-to-shadow-timeline";
import TimelineChart from "./TimelineChart";

interface TimelineProps {
  initialData?: {
    summary: TimelineSummary;
    timeline: ShadowTimelineEvent[];
  };
}

interface TimelineApiResponse {
  success: boolean;
  data?: {
    summary: TimelineSummary;
    timeline: ShadowTimelineEvent[];
  };
  error?: string;
  isMockData?: boolean;
}

export default function TimeToShadowTimeline({ initialData }: TimelineProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [filteredEvents, setFilteredEvents] = useState<ShadowTimelineEvent[]>([]);
  const [isMockData, setIsMockData] = useState<boolean>(false);
  
  const fetcher = useFetcher<TimelineApiResponse>();
  const isLoading = fetcher.state === 'loading';

  // Initialize with provided data or fetch from API
  useEffect(() => {
    if (!initialData) {
      fetcher.load('/api/timeline');
    } else {
      setFilteredEvents(initialData.timeline);
    }
  }, [initialData]);

  // Update filtered events when data changes
  useEffect(() => {
    const data = fetcher.data?.data || initialData;
    if (!data) return;

    let events = data.timeline || [];

    // Filter by severity
    if (selectedSeverity !== 'all') {
      events = events.filter((event: ShadowTimelineEvent) => event.severity === selectedSeverity);
    }

    // Filter by timeframe
    if (selectedTimeframe !== 'all') {
      const now = new Date();
      const days = parseInt(selectedTimeframe);
      const cutoffDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      events = events.filter((event: ShadowTimelineEvent) => {
        const eventDate = typeof event.estimatedDate === 'string' 
          ? new Date(event.estimatedDate) 
          : event.estimatedDate;
        return eventDate <= cutoffDate;
      });
    }

    setFilteredEvents(events);
    setIsMockData(fetcher.data?.isMockData || false);
  }, [fetcher.data, initialData, selectedSeverity, selectedTimeframe]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'high': return <AlertCircle className="w-4 h-4" />;
      case 'medium': return <Info className="w-4 h-4" />;
      case 'low': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntil = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffTime = dateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days`;
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const refreshData = () => {
    fetcher.load('/api/timeline');
  };

  const data = fetcher.data?.data || initialData;
  const summary = data?.summary;

  if (!data && isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-white" />
        <span className="text-white">Loading timeline data...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Timeline Data</h3>
        <p className="text-gray-300 mb-4">Unable to load timeline data. Please try again.</p>
        <Button onClick={refreshData} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mock Data Notice */}
      {isMockData && (
        <Card className="border-purple-700/50 bg-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TestTube className="w-5 h-5 text-purple-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-300 mb-1">Demo Mode Active</h4>
                <p className="text-sm text-purple-200">
                  This timeline is showing sample data to demonstrate the feature. 
                  Connect your AWS and Google accounts in Settings to see real timeline data based on your actual permissions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{summary.totalEvents}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{summary.criticalEvents}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">High Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-400">{summary.highRiskEvents}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Next 30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{summary.next30Days}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-white/5 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-300 mb-2 block">Severity</label>
              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-300 mb-2 block">Timeframe</label>
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="All timeframes" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="all">All timeframes</SelectItem>
                  <SelectItem value="7">Next 7 days</SelectItem>
                  <SelectItem value="30">Next 30 days</SelectItem>
                  <SelectItem value="90">Next 90 days</SelectItem>
                  <SelectItem value="180">Next 180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Legend */}
      <div className="flex items-center gap-4 mb-2 px-2">
        <span className="text-xs text-gray-400">Legend:</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" />Critical</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1" />High</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1" />Medium</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1" />Low</span>
      </div>

      {/* Timeline Chart Visualization */}
      <TimelineChart events={filteredEvents} />

      {/* Timeline Events */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Timeline Events ({filteredEvents.length})
          </h3>
          <Button onClick={refreshData} variant="outline" disabled={isLoading} className="border-gray-600 text-gray-300 hover:bg-gray-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {filteredEvents.length === 0 ? (
          <Card className="bg-white/5 border-gray-700">
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No Events Found</h4>
              <p className="text-gray-300">
                No timeline events match the current filters. Try adjusting your filter criteria.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <Card key={event.id} className="border-l-4 border-l-blue-500 bg-white/5 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getSeverityColor(event.severity)}>
                          {getSeverityIcon(event.severity)}
                          <span className="ml-1 capitalize">{event.severity}</span>
                        </Badge>
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                          {event.entityType}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                          {event.provider.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <CardTitle className="text-lg text-white">{event.entityName}</CardTitle>
                      <CardDescription className="mt-1 text-gray-300">
                        {event.description}
                      </CardDescription>
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="text-sm text-gray-300 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {getDaysUntil(event.estimatedDate)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatDate(event.estimatedDate)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {event.confidence}% confidence
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-300">{event.details}</p>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleEventExpansion(event.id)}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        {expandedEvents.has(event.id) ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            Show Details
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {expandedEvents.has(event.id) && (
                      <div className="mt-4 space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        {/* Risk Factors */}
                        <div>
                          <h5 className="font-medium text-white mb-2">Risk Factors</h5>
                          <div className="flex flex-wrap gap-2">
                            {event.factors.riskFactors.map((factor, index) => (
                              <Badge key={index} variant="secondary" className="text-xs bg-gray-700 text-gray-300">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        {/* Recommendations */}
                        <div>
                          <h5 className="font-medium text-white mb-2">Recommendations</h5>
                          <ul className="space-y-1">
                            {event.recommendations.map((rec, index) => (
                              <li key={index} className="text-sm text-gray-300 flex items-start">
                                <span className="text-blue-400 mr-2">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {/* Additional Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-300">Permission Level:</span>
                            <span className="ml-2 text-gray-400">{event.factors.permissionLevel}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-300">MFA Status:</span>
                            <span className="ml-2 text-gray-400">
                              {event.factors.mfaStatus ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-300">Inactivity Days:</span>
                            <span className="ml-2 text-gray-400">{event.factors.inactivityDays}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-300">Last Activity:</span>
                            <span className="ml-2 text-gray-400">
                              {event.factors.lastActivity 
                                ? formatDate(event.factors.lastActivity)
                                : 'Never'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 