import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { ArrowLeft, Download, Share2, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useWebSocket } from '../contexts/WebSocketContext';
import { JsonViewerTrigger } from '../components/JsonViewer';
import { SocialMediaLinks } from '../components/SocialMediaLinks';
import { ImageThumbnailCell } from '../components/ImageGalleryModal';
import api from '../services/api';

// Google Maps Constant Column Configuration (Apify-style)
// Field names match actual scraper output from Google Maps Scraper V3
const GOOGLE_MAPS_COLUMNS = {
  overview: [
    { key: 'title', label: 'Name', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'rating', label: 'Rating', type: 'number' },
    { key: 'reviewsCount', label: 'Reviews Count', type: 'number' },
    { key: 'totalScore', label: 'Total Score', type: 'number' }
  ],
  contactInfo: [
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'state', label: 'State', type: 'text' },
    { key: 'countryCode', label: 'Country Code', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'phoneVerified', label: 'Phone Verified', type: 'boolean' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'emailVerified', label: 'Email Verified', type: 'boolean' },
    { key: 'website', label: 'Website', type: 'url' },
    { key: 'additionalEmails', label: 'Additional Emails', type: 'array' },
    { key: 'additionalPhones', label: 'Additional Phones', type: 'array' },
    { key: 'contactPageUrl', label: 'Contact Page', type: 'url' },
    { key: 'websiteAddresses', label: 'Website Addresses', type: 'array' }
  ],
  location: [
    { key: 'placeId', label: 'Place ID', type: 'text' },
    { key: 'url', label: 'Google Maps URL', type: 'url' }
  ],
  hours: [
    { key: 'openingHours', label: 'Opening Hours', type: 'text' },
    { key: 'priceLevel', label: 'Price Level', type: 'text' }
  ],
  socialMedia: [
    { key: 'socialMedia', label: 'Social Media Links', type: 'complex' }
  ],
  media: [
    { key: 'images', label: 'Images', type: 'array' }
  ],
  reviews: [
    { key: 'reviews', label: 'Reviews', type: 'array' }
  ]
};

// Amazon Product Constant Column Configuration
// Field names match actual scraper output from Amazon Product Scraper
const AMAZON_COLUMNS = {
  overview: [
    { key: 'title', label: 'Product Title', type: 'text' },
    { key: 'asin', label: 'ASIN', type: 'text' },
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'url', label: 'Product URL', type: 'url' }
  ],
  pricing: [
    { key: 'price', label: 'Current Price', type: 'number' },
    { key: 'originalPrice', label: 'Original Price', type: 'number' },
    { key: 'discount', label: 'Discount %', type: 'number' },
    { key: 'currency', label: 'Currency', type: 'text' }
  ],
  ratingsReviews: [
    { key: 'rating', label: 'Rating', type: 'number' },
    { key: 'reviewCount', label: 'Review Count', type: 'number' },
    { key: 'reviews', label: 'Reviews', type: 'array' }
  ],
  availability: [
    { key: 'availability', label: 'Availability', type: 'text' },
    { key: 'prime', label: 'Prime Eligible', type: 'boolean' },
    { key: 'stock', label: 'Stock Quantity', type: 'number' },
    { key: 'shipping', label: 'Shipping Info', type: 'text' }
  ],
  media: [
    { key: 'images', label: 'Product Images', type: 'gallery' },
    { key: 'videos', label: 'Product Videos', type: 'gallery' }
  ],
  productDetails: [
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'features', label: 'Key Features', type: 'array' },
    { key: 'color', label: 'Color', type: 'text' },
    { key: 'size', label: 'Size', type: 'text' }
  ],
  specifications: [
    { key: 'dimensions', label: 'Dimensions', type: 'complex' },
    { key: 'specifications', label: 'Technical Specs', type: 'complex' }
  ],
  sellerInfo: [
    { key: 'seller', label: 'Seller Name', type: 'text' },
    { key: 'soldBy', label: 'Sold By', type: 'text' },
    { key: 'shipsFrom', label: 'Ships From', type: 'text' }
  ],
  additional: [
    { key: 'bestSellerRank', label: 'Best Seller Rank', type: 'text' },
    { key: 'searchKeyword', label: 'Search Keyword', type: 'text' }
  ]
};

// Helper function to get nested value from object
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Helper component to render cell value based on type
const RenderCellValue = ({ value, type, fieldKey, showAllSocialMedia = false, rowData = null, rowIndex = 0 }) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">-</span>;
  }

  // Special handling for socialMedia object - render with icons
  if (fieldKey === 'socialMedia' && typeof value === 'object' && !Array.isArray(value)) {
    return <SocialMediaLinks socialMedia={value} showAll={showAllSocialMedia} maxVisible={5} />;
  }

  // Special handling for gallery type (images/videos)
  if (type === 'gallery' && Array.isArray(value)) {
    const images = fieldKey === 'images' ? value : (rowData?.images || []);
    const videos = fieldKey === 'videos' ? value : (rowData?.videos || []);
    
    return (
      <ImageThumbnailCell 
        images={images}
        videos={videos}
        rowIndex={rowIndex}
      />
    );
  }

  switch (type) {
    case 'boolean':
      return (
        <span className={value ? 'text-green-600' : 'text-red-600'}>
          {value ? '✓ Yes' : '✗ No'}
        </span>
      );
    
    case 'url':
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all"
        >
          🔗 Open
        </a>
      );
    
    case 'number':
      return <span className="font-mono">{value}</span>;
    
    case 'date':
      return <span className="text-sm">{new Date(value).toLocaleString()}</span>;
    
    case 'array':
      if (!Array.isArray(value) || value.length === 0) {
        return <span className="text-muted-foreground">0 items</span>;
      }
      // Check if it's an array of simple strings (like emails or phones)
      if (value.every(item => typeof item === 'string')) {
        return (
          <div className="space-y-1">
            {value.slice(0, 3).map((item, idx) => (
              <div key={idx} className="text-xs">
                {item.startsWith('http') ? (
                  <a href={item} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    🔗 {item.length > 40 ? item.substring(0, 40) + '...' : item}
                  </a>
                ) : (
                  <span>{item}</span>
                )}
              </div>
            ))}
            {value.length > 3 && (
              <JsonViewerTrigger data={value} label={`+${value.length - 3} more`} />
            )}
          </div>
        );
      }
      return <JsonViewerTrigger data={value} label={`Array (${value.length} items)`} />;
    
    case 'complex':
      return <JsonViewerTrigger data={value} label="View object" />;
    
    case 'text':
    default:
      if (typeof value === 'string' && value.startsWith('http')) {
        return (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all"
          >
            🔗 Open
          </a>
        );
      }
      return <span className="block max-w-xs" title={String(value)}>{String(value)}</span>;
  }
};

export function RunDetail() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscribeToRun, unsubscribeFromRun, getRunUpdate } = useWebSocket();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false); // Disabled by default with WebSocket
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [goToPageInput, setGoToPageInput] = useState('1');
  const [resultsTab, setResultsTab] = useState('overview');
  
  useEffect(() => {
    fetchRun();
    
    // Subscribe to WebSocket updates for this run
    subscribeToRun(runId);
    
    // Auto-refresh if manually enabled (fallback)
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchRun(true);
      }
    }, 5000);
    
    return () => {
      clearInterval(interval);
      unsubscribeFromRun(runId);
    };
  }, [runId, autoRefresh]);
  
  // Handle WebSocket updates
  useEffect(() => {
    const update = getRunUpdate(runId);
    if (update) {
      setRun(prevRun => ({
        ...prevRun,
        ...update,
        // Parse output if needed
        output: typeof update.output === 'string' ? JSON.parse(update.output) : update.output
      }));
    }
  }, [getRunUpdate, runId]);
  
  const fetchRun = async (silent = false) => {
    try {
      const response = await api.get(`/api/runs/${runId}`);
      const runData = response.data;
      
      // Parse output if it's a string
      if (typeof runData.output === 'string') {
        try {
          runData.output = JSON.parse(runData.output);
        } catch (e) {
          // Failed to parse output
        }
      }
      
      setRun(runData);
      
      // Stop auto-refresh if run is completed
      if (runData.status !== 'running') {
        setAutoRefresh(false);
      }
      
      if (!silent) setLoading(false);
    } catch (error) {
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Failed to load run details',
          variant: 'destructive'
        });
        setLoading(false);
      }
    }
  };
  
  const downloadResults = () => {
    if (!run || !run.output) return;
    
    const dataStr = JSON.stringify(run.output, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scraper-results-${runId}.json`;
    link.click();
    
    toast({
      title: 'Downloaded',
      description: 'Results downloaded as JSON',
    });
  };
  
  const getStatusColor = (status) => {
    const colors = {
      succeeded: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      aborted: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      queued: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    };
    return colors[status] || colors.running;
  };

  // Extract results array from output if it exists
  const getResultsData = () => {
    if (!run?.output) return [];
    
    // Check if output is an object with 'results' array property
    if (run.output.results && Array.isArray(run.output.results)) {
      return run.output.results;
    }
    
    // Check if output is an array of objects with 'results' array property
    if (Array.isArray(run.output) && run.output.length > 0) {
      if (run.output[0]?.results && Array.isArray(run.output[0].results)) {
        // Flatten all results from all output items
        return run.output.flatMap(item => item.results || []);
      }
      // Otherwise return output array as-is
      return run.output;
    }
    
    // Otherwise return empty array
    return [];
  };
  
  const resultsData = getResultsData();
  
  // Check if this is a Google Maps scraper run
  const isGoogleMapsScraper = useMemo(() => {
    return run?.actorId === 'google-maps';
  }, [run?.actorId]);
  
  // Check if this is an Amazon scraper run
  const isAmazonScraper = useMemo(() => {
    return run?.actorId === 'amazon';
  }, [run?.actorId]);
  
  // Check if any result has social media data
  const hasSocialMediaData = useMemo(() => {
    if (!isGoogleMapsScraper || !resultsData || resultsData.length === 0) {
      return false;
    }
    
    return resultsData.some(item => {
      if (item.socialMedia && typeof item.socialMedia === 'object') {
        return Object.keys(item.socialMedia).some(key => item.socialMedia[key]);
      }
      return false;
    });
  }, [isGoogleMapsScraper, resultsData]);
  
  // Use the static columns configuration for Google Maps
  const completeGoogleMapsColumns = useMemo(() => {
    return GOOGLE_MAPS_COLUMNS;
  }, []);
  
  // All fields including dynamic social media
  const allGoogleMapsFields = useMemo(() => {
    return Object.values(completeGoogleMapsColumns).flat();
  }, [completeGoogleMapsColumns]);
  
  // Pagination handlers
  const totalPages = Math.ceil((resultsData?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOutput = resultsData?.slice(startIndex, startIndex + itemsPerPage) || [];

  const handleGoToPage = () => {
    let pageNum = parseInt(goToPageInput);
    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    } else if (pageNum > totalPages) {
      pageNum = totalPages;
    }
    setCurrentPage(pageNum);
    setGoToPageInput(pageNum.toString());
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setGoToPageInput((currentPage - 1).toString());
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setGoToPageInput((currentPage + 1).toString());
    }
  };
  
  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <Header title="Loading..." />
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin text-4xl">⏳</div>
        </div>
      </div>
    );
  }
  
  if (!run) {
    return (
      <div className="flex-1 overflow-auto">
        <Header title="Run Not Found" />
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">The run you're looking for doesn't exist.</p>
          <Link to="/runs">
            <Button>Back to Runs</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-auto">
      <Header 
        title="Run Details"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" onClick={downloadResults}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        }
      />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Run Status Card */}
        <Card className={run.status === 'succeeded' ? 'border-green-200 dark:border-green-800' : ''}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={getStatusColor(run.status)}>
                    {run.status === 'succeeded' && '✓ '}
                    {run.status === 'aborted' && '⊘ '}
                    {run.status === 'running' && '⟳ '}
                    {run.status === 'queued' && '⏳ '}
                    {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                  </Badge>
                </div>
                
                <Link to={`/actors/${run.actorId}`}>
                  <h2 className="text-2xl font-bold mb-2 hover:underline cursor-pointer">{run.actorName}</h2>
                </Link>
                
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Results</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{resultsData?.length || run.resultCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="text-2xl font-bold">{run.duration || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Usage</p>
                    <p className="text-2xl font-bold">${run.usage?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Run ID</p>
                    <p className="text-sm font-mono truncate">{run.runId}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Started</p>
                    <p className="font-medium">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                  {run.finishedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Finished</p>
                      <p className="font-medium">
                        {new Date(run.finishedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Tabs */}
        <Tabs defaultValue="output">
          <TabsList>
            <TabsTrigger value="output">Output ({run.output?.length || 0})</TabsTrigger>
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>
          
          <TabsContent value="output">
            {/* Search Metadata */}
            {run.output && run.output.length > 0 && run.output[0]?.results && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">Search Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(run.output[0]).map(([key, value]) => {
                      if (key === 'results' || typeof value === 'object') return null;
                      return (
                        <div key={key}>
                          <p className="text-sm text-muted-foreground mb-1">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </p>
                          <p className="font-medium text-sm">
                            {typeof value === 'string' && value.startsWith('http') ? (
                              <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                                View URL
                              </a>
                            ) : (
                              String(value || '-')
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Scraped Results ({resultsData?.length || 0} items)</CardTitle>
                  {run.output && run.output.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={downloadResults}>
                        <Download className="h-4 w-4 mr-2" />
                        Download JSON
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {resultsData && resultsData.length > 0 ? (
                  <>
                    {/* Google Maps Constant Column Display */}
                    {isGoogleMapsScraper ? (
                      <>
                        {/* Tabs for different field groups */}
                        <Tabs value={resultsTab} onValueChange={setResultsTab} className="w-full">
                          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Overview</TabsTrigger>
                            <TabsTrigger value="contactInfo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Contact Info</TabsTrigger>
                            <TabsTrigger value="location" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Location</TabsTrigger>
                            <TabsTrigger value="hours" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Hours & Price</TabsTrigger>
                            {hasSocialMediaData && (
                              <TabsTrigger value="socialMedia" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                                Social Media
                              </TabsTrigger>
                            )}
                            <TabsTrigger value="media" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Images</TabsTrigger>
                            <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Reviews</TabsTrigger>
                            <TabsTrigger value="allFields" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">All Fields</TabsTrigger>
                            <TabsTrigger value="rawJson" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Raw JSON</TabsTrigger>
                          </TabsList>

                          {/* Render table for each tab */}
                          {Object.entries(completeGoogleMapsColumns).map(([tabKey, columns]) => (
                            <TabsContent key={tabKey} value={tabKey} className="mt-0">
                              {columns.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                  <p>No {tabKey === 'socialMedia' ? 'social media links' : 'data'} available</p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="border-b bg-muted/50 sticky top-0">
                                      <tr className="text-sm text-muted-foreground">
                                        <th className="text-left p-4 font-medium w-12 bg-muted/50">#</th>
                                        {columns.map((col) => (
                                          <th key={col.key} className="text-left p-4 font-medium min-w-[150px] bg-muted/50 whitespace-nowrap">
                                            {col.label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {paginatedOutput.map((item, index) => (
                                        <tr key={startIndex + index} className="border-b hover:bg-muted/50 transition-colors">
                                          <td className="p-4 text-sm text-muted-foreground font-mono bg-muted/30">
                                            {startIndex + index + 1}
                                          </td>
                                          {columns.map((col) => {
                                            const value = col.nested ? getNestedValue(item, col.key) : item[col.key];
                                            return (
                                              <td key={col.key} className="p-4 text-sm align-top">
                                                <RenderCellValue value={value} type={col.type} fieldKey={col.key} showAllSocialMedia={tabKey === 'socialMedia'} rowData={item} rowIndex={startIndex + index} />
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </TabsContent>
                          ))}

                          {/* All Fields Tab */}
                          <TabsContent value="allFields" className="mt-0">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="border-b bg-muted/50 sticky top-0">
                                  <tr className="text-sm text-muted-foreground">
                                    <th className="text-left p-4 font-medium w-12 bg-muted/50">#</th>
                                    {allGoogleMapsFields.map((col) => (
                                      <th key={col.key} className="text-left p-4 font-medium min-w-[150px] bg-muted/50 whitespace-nowrap">
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedOutput.map((item, index) => (
                                    <tr key={startIndex + index} className="border-b hover:bg-muted/50 transition-colors">
                                      <td className="p-4 text-sm text-muted-foreground font-mono bg-muted/30">
                                        {startIndex + index + 1}
                                      </td>
                                      {allGoogleMapsFields.map((col) => {
                                        const value = col.nested ? getNestedValue(item, col.key) : item[col.key];
                                        return (
                                          <td key={col.key} className="p-4 text-sm align-top">
                                            <RenderCellValue value={value} type={col.type} fieldKey={col.key} rowData={item} rowIndex={startIndex + index} />
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </TabsContent>

                          {/* Raw JSON Tab */}
                          <TabsContent value="rawJson" className="mt-0">
                            <div className="p-4">
                              <ScrollArea className="h-[600px] w-full">
                                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto font-mono">
                                  {JSON.stringify(paginatedOutput, null, 2)}
                                </pre>
                              </ScrollArea>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </>
                    ) : isAmazonScraper ? (
                      /* Amazon Product Column Display */
                      <>
                        <Tabs value={resultsTab} onValueChange={setResultsTab} className="w-full">
                          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Overview</TabsTrigger>
                            <TabsTrigger value="pricing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Pricing</TabsTrigger>
                            <TabsTrigger value="ratingsReviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Ratings & Reviews</TabsTrigger>
                            <TabsTrigger value="availability" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Availability</TabsTrigger>
                            <TabsTrigger value="media" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Media</TabsTrigger>
                            <TabsTrigger value="productDetails" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Product Details</TabsTrigger>
                            <TabsTrigger value="specifications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Specifications</TabsTrigger>
                            <TabsTrigger value="sellerInfo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Seller Info</TabsTrigger>
                            <TabsTrigger value="additional" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Additional</TabsTrigger>
                            <TabsTrigger value="allFields" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">All Fields</TabsTrigger>
                            <TabsTrigger value="rawJson" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Raw JSON</TabsTrigger>
                          </TabsList>

                          {/* Render table for each tab */}
                          {Object.entries(AMAZON_COLUMNS).map(([tabKey, columns]) => (
                            <TabsContent key={tabKey} value={tabKey} className="mt-0">
                              {columns.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                  <p>No data available</p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="border-b bg-muted/50 sticky top-0">
                                      <tr className="text-sm text-muted-foreground">
                                        <th className="text-left p-4 font-medium w-12 bg-muted/50">#</th>
                                        {columns.map((col) => (
                                          <th key={col.key} className="text-left p-4 font-medium min-w-[150px] bg-muted/50 whitespace-nowrap">
                                            {col.label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {paginatedOutput.map((item, index) => (
                                        <tr key={startIndex + index} className="border-b hover:bg-muted/50 transition-colors">
                                          <td className="p-4 text-sm text-muted-foreground font-mono bg-muted/30">
                                            {startIndex + index + 1}
                                          </td>
                                          {columns.map((col) => {
                                            const value = col.nested ? getNestedValue(item, col.key) : item[col.key];
                                            return (
                                              <td key={col.key} className="p-4 text-sm align-top">
                                                <RenderCellValue value={value} type={col.type} fieldKey={col.key} />
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </TabsContent>
                          ))}

                          {/* All Fields Tab */}
                          <TabsContent value="allFields" className="mt-0">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="border-b bg-muted/50 sticky top-0">
                                  <tr className="text-sm text-muted-foreground">
                                    <th className="text-left p-4 font-medium w-12 bg-muted/50">#</th>
                                    {Object.values(AMAZON_COLUMNS).flat().map((col) => (
                                      <th key={col.key} className="text-left p-4 font-medium min-w-[150px] bg-muted/50 whitespace-nowrap">
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedOutput.map((item, index) => (
                                    <tr key={startIndex + index} className="border-b hover:bg-muted/50 transition-colors">
                                      <td className="p-4 text-sm text-muted-foreground font-mono bg-muted/30">
                                        {startIndex + index + 1}
                                      </td>
                                      {Object.values(AMAZON_COLUMNS).flat().map((col) => {
                                        const value = col.nested ? getNestedValue(item, col.key) : item[col.key];
                                        return (
                                          <td key={col.key} className="p-4 text-sm align-top">
                                            <RenderCellValue value={value} type={col.type} fieldKey={col.key} />
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </TabsContent>

                          {/* Raw JSON Tab */}
                          <TabsContent value="rawJson" className="mt-0">
                            <div className="p-4">
                              <ScrollArea className="h-[600px] w-full">
                                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto font-mono">
                                  {JSON.stringify(paginatedOutput, null, 2)}
                                </pre>
                              </ScrollArea>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </>
                    ) : (
                      /* Dynamic Column Display for other scrapers */
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="border-b bg-muted/50 sticky top-0">
                            <tr className="text-sm text-muted-foreground">
                              <th className="text-left p-4 font-medium w-12 bg-muted/50">#</th>
                              {Object.keys(resultsData[0]).map((key) => (
                                <th key={key} className="text-left p-4 font-medium min-w-[150px] bg-muted/50 whitespace-nowrap">
                                  {key
                                    .replace(/([A-Z])/g, ' $1')
                                    .replace(/^./, str => str.toUpperCase())
                                    .replace(/_/g, ' ')
                                    .trim()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedOutput.map((item, index) => (
                              <tr key={startIndex + index} className="border-b hover:bg-muted/50 transition-colors">
                                <td className="p-4 text-sm text-muted-foreground font-mono bg-muted/30">
                                  {startIndex + index + 1}
                                </td>
                                {Object.entries(item).map(([key, value]) => (
                                  <td key={key} className="p-4 text-sm align-top">
                                    {value === null || value === undefined ? (
                                      <span className="text-muted-foreground">-</span>
                                    ) : key === 'socialMedia' && typeof value === 'object' && !Array.isArray(value) ? (
                                      <SocialMediaLinks socialMedia={value} maxVisible={5} />
                                    ) : (key === 'additionalEmails' || key === 'additionalPhones' || key === 'websiteAddresses') && Array.isArray(value) && value.length > 0 ? (
                                      <div className="space-y-1">
                                        {value.slice(0, 3).map((item, idx) => (
                                          <div key={idx} className="text-xs">{item}</div>
                                        ))}
                                        {value.length > 3 && (
                                          <JsonViewerTrigger data={value} label={`+${value.length - 3} more`} />
                                        )}
                                      </div>
                                    ) : typeof value === 'object' ? (
                                      <JsonViewerTrigger 
                                        data={value} 
                                        label={Array.isArray(value) ? `Array (${value.length} items)` : 'View object'}
                                      />
                                    ) : typeof value === 'string' && value.startsWith('http') ? (
                                      <a 
                                        href={value} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all"
                                        title={value}
                                      >
                                        🔗 Open
                                      </a>
                                    ) : typeof value === 'number' ? (
                                      <span className="font-mono">{value}</span>
                                    ) : typeof value === 'boolean' ? (
                                      <span className={value ? 'text-green-600' : 'text-red-600'}>
                                        {value ? '✓ Yes' : '✗ No'}
                                      </span>
                                    ) : (
                                      <span className="block max-w-xs" title={String(value)}>
                                        {String(value || '-')}
                                      </span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    
                    {/* Pagination */}
                    {resultsData.length > 0 && (
                      <div className="flex items-center justify-between p-4 border-t bg-muted/20">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Items per page:</span>
                          <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                            setItemsPerPage(parseInt(value));
                            setCurrentPage(1);
                            setGoToPageInput('1');
                          }}>
                            <SelectTrigger className="w-[80px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                              <SelectItem value="500">500</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground ml-4">
                            Showing {startIndex + 1} - {Math.min(startIndex + itemsPerPage, resultsData.length)} of {resultsData.length}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Go to page:</span>
                          <Input 
                            className="w-16 h-8" 
                            value={goToPageInput} 
                            onChange={(e) => setGoToPageInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
                            type="number" 
                            min="1"
                            max={totalPages}
                          />
                          <Button variant="outline" size="sm" onClick={handleGoToPage}>Go</Button>
                          <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>‹</Button>
                          <span className="text-sm px-2">{currentPage} / {totalPages || 1}</span>
                          <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>›</Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {run.status === 'running' ? (
                      <>
                        <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin" />
                        <p>Scraping in progress...</p>
                      </>
                    ) : (
                      <p>No output data available</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="input">
            <Card>
              <CardHeader>
                <CardTitle>Input Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                  {JSON.stringify(run.input, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="log">
            <Card>
              <CardHeader>
                <CardTitle>Execution Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] w-full">
                  <div className="font-mono text-sm space-y-1">
                    <p>[{new Date(run.startedAt).toLocaleTimeString()}] Run started</p>
                    <p>[{new Date(run.startedAt).toLocaleTimeString()}] Actor: {run.actorName}</p>
                    <p>[{new Date(run.startedAt).toLocaleTimeString()}] Input validated</p>
                    {run.status !== 'running' && (
                      <>
                        <p>[{new Date(run.finishedAt).toLocaleTimeString()}] Scraping completed</p>
                        <p>[{new Date(run.finishedAt).toLocaleTimeString()}] Results: {run.resultCount} items</p>
                        {run.error && (
                          <p className="text-red-600">[ERROR] {run.error}</p>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="storage">
            <Card>
              <CardHeader>
                <CardTitle>Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Dataset</span>
                      <Badge variant="outline">Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {run.resultCount} items stored
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Key-Value Store</span>
                      <Badge variant="outline">Empty</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No key-value pairs stored
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}