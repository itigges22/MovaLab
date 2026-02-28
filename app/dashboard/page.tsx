'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useState, Suspense, useMemo, useCallback } from 'react'
import { RoleGuard } from "@/components/role-guard"
import { Button } from '@/components/ui/button'
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil, X, Eye, EyeOff, Check, GripVertical } from 'lucide-react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import Masonry from 'react-masonry-css'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'

// Loading skeleton for components
const ComponentSkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-8 w-full" />
  </div>
)

// Code Splitting with dynamic imports
const CapacityDashboard = dynamic(() => import('@/components/capacity-dashboard'), {
  loading: () => <ComponentSkeleton />,
  ssr: false
})
const UnifiedProjectsSection = dynamic(
  () => import('@/components/unified-projects-section').then(mod => mod.UnifiedProjectsSection),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyTimeWidget = dynamic(
  () => import('@/components/dashboard/my-time-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyTasksWidget = dynamic(
  () => import('@/components/dashboard/my-tasks-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyWorkflowsWidget = dynamic(
  () => import('@/components/dashboard/my-workflows-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyAccountsWidget = dynamic(
  () => import('@/components/dashboard/my-accounts-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const MyCollaboratorsWidget = dynamic(
  () => import('@/components/dashboard/my-collaborators-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const TimeByProjectWidget = dynamic(
  () => import('@/components/dashboard/time-by-project-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const TaskCompletionTrendWidget = dynamic(
  () => import('@/components/dashboard/task-completion-trend-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const UpcomingDeadlinesWidget = dynamic(
  () => import('@/components/dashboard/upcoming-deadlines-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)
const RecentActivityWidget = dynamic(
  () => import('@/components/dashboard/recent-activity-widget'),
  { loading: () => <ComponentSkeleton />, ssr: false }
)

// Types
interface WidgetConfig {
  id: string;
  type: string;
  visible: boolean;
  order: number;
  size: string;
}

interface DashboardPreferences {
  widgets: WidgetConfig[];
  theme?: 'compact' | 'comfortable';
}

interface PreferencesResponse {
  success: boolean;
  data: {
    widgetConfig: DashboardPreferences;
    isDefault: boolean;
    updatedAt?: string;
  };
}

interface MyAnalyticsData {
  time: {
    hoursToday: number;
    hoursThisWeek: number;
    hoursThisMonth: number;
    weeklyTarget: number;
    dailyAverage: number;
  };
  tasks: {
    inProgress: number;
    dueThisWeek: number;
    overdue: number;
    completedThisWeek: number;
    urgent: { id: string; name: string; projectId: string; projectName: string; dueDate: string; status: string }[];
  };
}

// Widget types - full-width widgets render separately, others go in masonry grid
const FULL_WIDTH_WIDGETS = new Set(['projects', 'capacity', 'activity']);

// Masonry breakpoints: { screenWidth: numberOfColumns }
// Desktop: 4 columns, Tablet: 2-3 columns, Mobile: 1 column
const MASONRY_BREAKPOINTS = {
  default: 4,  // 4 columns on large screens
  1200: 3,     // 3 columns at 1200px and below
  900: 2,      // 2 columns at 900px and below
  600: 1,      // 1 column at 600px and below (mobile)
};

// Render group type for proper ordering
interface RenderGroup {
  type: 'full-width' | 'masonry';
  widgets: string[];
}

// Widget display labels
const WIDGET_LABELS: Record<string, string> = {
  'projects': 'My Projects',
  'capacity': 'Capacity Chart',
  'time': 'My Time',
  'tasks': 'My Tasks',
  'workflows': 'My Workflows',
  'accounts': 'My Accounts',
  'collaborators': 'My Collaborators',
  'time-by-project': 'Time by Project',
  'task-trend': 'Task Trend',
  'deadlines': 'Upcoming Deadlines',
  'activity': 'Recent Activity',
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Sortable widget wrapper component
function SortableWidget({
  id,
  children,
  isVisible,
  label,
  onToggleVisibility,
}: {
  id: string;
  children: React.ReactNode;
  isVisible: boolean;
  label: string;
  onToggleVisibility: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id });

  return (
    <motion.div
      ref={setNodeRef}
      className={`relative group ${isDragging ? 'z-50' : ''}`}
      animate={{
        opacity: isVisible ? (isDragging ? 0.7 : 1) : 0.4,
        scale: isDragging ? 1.02 : 1,
      }}
      transition={{ duration: 0.15 }}
    >
      {/* Edit overlay */}
      <div
        className={`absolute inset-0 z-10 rounded-lg border-2 transition-colors ${
          isDragging
            ? 'border-[#007EE5] bg-[#007EE5]/10 shadow-lg'
            : isVisible
              ? 'border-transparent group-hover:border-[#007EE5] group-hover:bg-[#007EE5]/5'
              : 'border-dashed border-muted-foreground/30 bg-muted/20'
        }`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className={`absolute top-2 left-2 p-1.5 rounded-md shadow-sm border border-border transition-colors ${
            isDragging
              ? 'bg-[#007EE5] text-white cursor-grabbing'
              : 'bg-background/90 cursor-grab hover:bg-muted'
          }`}
        >
          <GripVertical className={`h-4 w-4 ${isDragging ? 'text-white' : 'text-muted-foreground'}`} />
        </button>

        {/* Visibility toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          className={`absolute top-2 right-2 flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            isVisible
              ? 'bg-background/90 text-foreground shadow-sm border border-border hover:bg-muted'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {isVisible ? (
            <>
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            <>
              <EyeOff className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </>
          )}
        </button>
      </div>

      {/* Widget content */}
      <div className={isVisible ? '' : 'pointer-events-none'}>
        {children}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { userProfile } = useAuth()
  const [capacityRefreshKey, _setCapacityRefreshKey] = useState(0)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editModeWidgets, setEditModeWidgets] = useState<Record<string, boolean>>({})
  const [editModeOrder, setEditModeOrder] = useState<string[]>([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch dashboard preferences
  const { data: preferencesData, mutate: mutatePreferences } = useSWR<PreferencesResponse>(
    '/api/dashboard/preferences',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  // Fetch analytics data for widgets
  const { data: analyticsData, isLoading: analyticsLoading } = useSWR<{ success: boolean; data: MyAnalyticsData }>(
    '/api/dashboard/my-analytics',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const preferences = preferencesData?.data?.widgetConfig
  const analytics = analyticsData?.data

  // Get user's first name for greeting
  const firstName = (userProfile as any)?.name?.split(' ')[0] || 'there'

  // Initialize edit mode widgets from preferences
  const startEditMode = useCallback(() => {
    const defaultWidgets = [
      'projects', 'capacity', 'time', 'tasks', 'workflows',
      'accounts', 'collaborators', 'time-by-project', 'task-trend',
      'deadlines', 'activity'
    ];

    const visibility: Record<string, boolean> = {};
    let order: string[] = [];

    if (preferences?.widgets && preferences.widgets.length > 0) {
      const sorted = [...preferences.widgets].sort((a, b) => a.order - b.order);
      sorted.forEach(w => {
        visibility[w.type] = w.visible;
        order.push(w.type);
      });
    } else {
      defaultWidgets.forEach(w => {
        visibility[w] = true;
      });
      order = [...defaultWidgets];
    }

    setEditModeWidgets(visibility);
    setEditModeOrder(order);
    setIsEditMode(true);
  }, [preferences]);

  // Toggle widget visibility in edit mode
  const toggleWidgetVisibility = useCallback((widgetType: string) => {
    setEditModeWidgets(prev => ({
      ...prev,
      [widgetType]: !prev[widgetType]
    }));
  }, []);

  // Drag handler
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditModeOrder(items => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // Save edit mode changes
  const saveEditModeChanges = useCallback(async () => {
    setIsSavingEdit(true);
    try {
      // Build widgets array with new order and visibility
      const sizeMap: Record<string, string> = {
        'projects': 'full',
        'capacity': 'full',
        'activity': 'full',
        'accounts': 'medium',
        'collaborators': 'medium',
      };

      const updatedWidgets = editModeOrder.map((type, index) => ({
        id: type,
        type: type,
        visible: editModeWidgets[type] ?? true,
        order: index,
        size: sizeMap[type] || 'small',
      }));

      const response = await fetch('/api/dashboard/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetConfig: {
            widgets: updatedWidgets,
            theme: preferences?.theme || 'comfortable'
          }
        }),
      });

      if (response.ok) {
        await mutatePreferences();
      }
    } catch {
      // Preference save failed - non-critical
    } finally {
      setIsSavingEdit(false);
      setIsEditMode(false);
    }
  }, [editModeOrder, editModeWidgets, preferences, mutatePreferences]);

  // Cancel edit mode
  const cancelEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditModeWidgets({});
    setEditModeOrder([]);
  }, []);

  // Check if widget is visible (respects edit mode state)
  const isWidgetVisible = useCallback((widgetType: string): boolean => {
    if (isEditMode) {
      return editModeWidgets[widgetType] ?? true;
    }
    if (!preferences?.widgets) return true;
    const widget = preferences.widgets.find(w => w.type === widgetType);
    return widget?.visible ?? true;
  }, [isEditMode, editModeWidgets, preferences]);

  // Sort and group widgets - properly interleave full-width and masonry
  // This ensures widgets render in true order (e.g., activity at end stays at end)
  // In edit mode, use editModeOrder for live reordering
  const renderGroups = useMemo((): RenderGroup[] => {
    const defaultOrder = [
      'projects', 'capacity', 'time', 'tasks', 'workflows',
      'accounts', 'collaborators', 'time-by-project', 'task-trend',
      'deadlines', 'activity'
    ];

    // Get sorted widgets
    let sortedWidgets: string[];
    if (isEditMode && editModeOrder.length > 0) {
      // In edit mode, use the live order being edited
      sortedWidgets = editModeOrder;
    } else if (preferences?.widgets) {
      sortedWidgets = [...preferences.widgets]
        .filter(w => w.visible)
        .sort((a, b) => a.order - b.order)
        .map(w => w.type);
    } else {
      sortedWidgets = defaultOrder;
    }

    // Build render groups that interleave full-width and masonry widgets
    // This ensures order is truly respected (activity at end stays at end)
    const groups: RenderGroup[] = [];
    let currentMasonryBatch: string[] = [];

    sortedWidgets.forEach(type => {
      if (FULL_WIDTH_WIDGETS.has(type)) {
        // Flush any pending masonry batch before adding full-width
        if (currentMasonryBatch.length > 0) {
          groups.push({ type: 'masonry', widgets: [...currentMasonryBatch] });
          currentMasonryBatch = [];
        }
        groups.push({ type: 'full-width', widgets: [type] });
      } else {
        currentMasonryBatch.push(type);
      }
    });

    // Flush final masonry batch
    if (currentMasonryBatch.length > 0) {
      groups.push({ type: 'masonry', widgets: currentMasonryBatch });
    }

    return groups;
  }, [preferences, isEditMode, editModeOrder]);

  // Render a widget by type
  const renderWidget = (type: string) => {
    switch (type) {
      case 'projects':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <UnifiedProjectsSection userProfile={userProfile as any} />
          </Suspense>
        );
      case 'capacity':
        return userProfile ? (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <CapacityDashboard key={capacityRefreshKey} userProfile={userProfile} />
          </Suspense>
        ) : null;
      case 'activity':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <RecentActivityWidget />
          </Suspense>
        );
      case 'time':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <MyTimeWidget data={analytics?.time || null} isLoading={analyticsLoading} />
          </Suspense>
        );
      case 'tasks':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <MyTasksWidget data={analytics?.tasks || null} isLoading={analyticsLoading} />
          </Suspense>
        );
      case 'workflows':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <MyWorkflowsWidget />
          </Suspense>
        );
      case 'accounts':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <MyAccountsWidget />
          </Suspense>
        );
      case 'collaborators':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <MyCollaboratorsWidget />
          </Suspense>
        );
      case 'time-by-project':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <TimeByProjectWidget />
          </Suspense>
        );
      case 'task-trend':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <TaskCompletionTrendWidget />
          </Suspense>
        );
      case 'deadlines':
        return (
          <Suspense key={type} fallback={<ComponentSkeleton />}>
            <UpcomingDeadlinesWidget />
          </Suspense>
        );
      default:
        return null;
    }
  };

  // Render widget with sortable wrapper when in edit mode
  const renderEditableWidget = (type: string) => {
    const widgetContent = renderWidget(type);
    const visible = isWidgetVisible(type);
    const label = WIDGET_LABELS[type] || type;

    if (!isEditMode) {
      return widgetContent;
    }

    return (
      <SortableWidget
        id={type}
        isVisible={visible}
        label={label}
        onToggleVisibility={() => toggleWidgetVisibility(type)}
      >
        {widgetContent}
      </SortableWidget>
    );
  };

  return (
    <RoleGuard>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {firstName}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isEditMode
                ? 'Drag to reorder, click eye to show/hide widgets'
                : "Here's what's happening with your projects"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {isEditMode ? (
                <motion.div
                  key="edit-controls"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEditMode}
                    disabled={isSavingEdit}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEditModeChanges}
                    disabled={isSavingEdit}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    {isSavingEdit ? 'Saving...' : 'Done'}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="normal-controls"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditMode}
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Edit Layout
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Widget rendering - with DnD context in edit mode */}
        {isEditMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={editModeOrder}
              strategy={rectSortingStrategy}
            >
              {renderGroups.map((group, groupIndex) => (
                group.type === 'full-width' ? (
                  <section key={`full-${groupIndex}`}>
                    {renderEditableWidget(group.widgets[0])}
                  </section>
                ) : (
                  <Masonry
                    key={`masonry-${groupIndex}`}
                    breakpointCols={MASONRY_BREAKPOINTS}
                    className="masonry-grid"
                    columnClassName="masonry-grid-column"
                  >
                    {group.widgets.map(type => (
                      <div key={type} className="mb-4">
                        {renderEditableWidget(type)}
                      </div>
                    ))}
                  </Masonry>
                )
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          // Normal mode - no drag and drop
          renderGroups.map((group, groupIndex) => (
            group.type === 'full-width' ? (
              <section key={`full-${groupIndex}`}>
                {renderWidget(group.widgets[0])}
              </section>
            ) : (
              <Masonry
                key={`masonry-${groupIndex}`}
                breakpointCols={MASONRY_BREAKPOINTS}
                className="masonry-grid"
                columnClassName="masonry-grid-column"
              >
                {group.widgets.map(type => (
                  <div key={type} className="mb-4">
                    {renderWidget(type)}
                  </div>
                ))}
              </Masonry>
            )
          ))
        )}
      </div>
    </RoleGuard>
  )
}
