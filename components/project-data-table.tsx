'use client';

import * as React from "react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, Clock, ChevronUp, ChevronDown, ChevronsUpDown, Settings2 } from "lucide-react";

// --- TYPE DEFINITIONS ---
export interface AssignedUser {
  id: string;
  name: string;
  email?: string;
  image?: string;
}

export type ProjectStatus = "planning" | "in_progress" | "review" | "complete" | "on_hold";
export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export interface ProjectTableData {
  id: string;
  name: string;
  workflowStep?: string;
  priority: ProjectPriority;
  account?: string;
  accountId?: string;
  hours?: {
    estimated?: number;
    actual?: number;
    remaining?: number;
  };
  deadline?: string;
  assignedUsers: AssignedUser[];
  status: ProjectStatus;
}

type SortDirection = "asc" | "desc" | null;
type SortableColumn = "name" | "priority" | "account" | "deadline" | "status";

// --- PROPS INTERFACE ---
interface ProjectDataTableProps {
  projects: ProjectTableData[];
  defaultVisibleColumns?: (keyof ProjectTableData)[];
  onRowClick?: (project: ProjectTableData) => void;
  showColumnToggle?: boolean;
}

// --- STATUS BADGE VARIANTS (Brand Colors) ---
const statusBadgeVariants = cva("capitalize text-white text-xs", {
  variants: {
    variant: {
      planning: "bg-[#787878] hover:bg-[#647878]",
      in_progress: "bg-[#007EE5] hover:bg-[#0066CC]",
      review: "bg-[#647878] hover:bg-[#475250]",
      complete: "bg-[#4A5D3A] hover:bg-[#3A4D2A]",
      on_hold: "bg-[#3D464D] hover:bg-[#282828]",
    },
  },
  defaultVariants: {
    variant: "planning",
  },
});

// --- PRIORITY BADGE VARIANTS (Brand Colors) ---
const priorityBadgeVariants = cva("capitalize text-xs", {
  variants: {
    variant: {
      low: "bg-[#787878]/15 text-[#475250] hover:bg-[#787878]/25 dark:bg-[#787878]/25 dark:text-[#7B8994]",
      medium: "bg-[#647878]/15 text-[#3D464D] hover:bg-[#647878]/25 dark:bg-[#647878]/25 dark:text-[#787878]",
      high: "bg-[#007EE5]/15 text-[#007EE5] hover:bg-[#007EE5]/25 dark:bg-[#007EE5]/25",
      urgent: "bg-[#3D464D]/20 text-[#282828] hover:bg-[#3D464D]/30 dark:bg-[#3D464D]/40 dark:text-[#7B8994]",
    },
  },
  defaultVariants: {
    variant: "medium",
  },
});

// --- HELPER FUNCTIONS ---
const formatStatus = (status: ProjectStatus): string => {
  return status.replace(/_/g, ' ');
};

const formatHours = (hours?: { estimated?: number; actual?: number; remaining?: number }): string => {
  if (!hours) return '-';
  if (hours.actual != null && hours.estimated != null) {
    return `${hours.actual}h / ${hours.estimated}h`;
  }
  if (hours.actual != null) return `${hours.actual}h logged`;
  if (hours.estimated != null) return `${hours.estimated}h est.`;
  return '-';
};

const formatDeadline = (deadline?: string): { text: string; isOverdue: boolean; isNear: boolean } => {
  if (!deadline) return { text: '-', isOverdue: false, isNear: false };

  // Parse date-only strings as local to avoid UTC off-by-one
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const [year, month, day] = deadline.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(deadline);
  }
  const now = new Date();
  const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    text: formatted,
    isOverdue: daysUntil < 0,
    isNear: daysUntil >= 0 && daysUntil <= 7,
  };
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Priority order for sorting
const priorityOrder: Record<ProjectPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// Status order for sorting
const statusOrder: Record<ProjectStatus, number> = {
  on_hold: 1,
  planning: 2,
  in_progress: 3,
  review: 4,
  complete: 5,
};

// --- TABLE HEADER DEFINITIONS ---
const allTableHeaders: { key: keyof ProjectTableData; label: string; sortable: boolean }[] = [
  { key: "name", label: "Project", sortable: true },
  { key: "workflowStep", label: "Workflow Step", sortable: false },
  { key: "priority", label: "Priority", sortable: true },
  { key: "account", label: "Account", sortable: true },
  { key: "hours", label: "Hours", sortable: false },
  { key: "deadline", label: "Deadline", sortable: true },
  { key: "assignedUsers", label: "Team", sortable: false },
  { key: "status", label: "Status", sortable: true },
];

// --- SORTABLE HEADER COMPONENT ---
interface SortableHeaderProps {
  label: string;
  columnKey: SortableColumn;
  currentSort: { column: SortableColumn | null; direction: SortDirection };
  onSort: (column: SortableColumn) => void;
}

const SortableHeader = ({ label, columnKey, currentSort, onSort }: SortableHeaderProps) => {
  const isActive = currentSort.column === columnKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <button
      onClick={() => onSort(columnKey)}
      className="flex items-center gap-1 hover:text-foreground transition-colors group"
      aria-label={`Sort by ${label}${direction === "asc" ? ", sorted ascending" : direction === "desc" ? ", sorted descending" : ""}`}
    >
      <span>{label}</span>
      <span className={cn(
        "transition-opacity",
        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
      )} aria-hidden="true">
        {direction === "asc" ? (
          <ChevronUp className="h-4 w-4" />
        ) : direction === "desc" ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronsUpDown className="h-4 w-4" />
        )}
      </span>
    </button>
  );
};

// --- MAIN COMPONENT ---
export const ProjectDataTable = ({
  projects,
  defaultVisibleColumns = ["name", "workflowStep", "priority", "account", "hours", "deadline", "assignedUsers", "status"],
  onRowClick,
  showColumnToggle = true,
}: ProjectDataTableProps) => {
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof ProjectTableData>>(
    new Set(defaultVisibleColumns)
  );

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ column: SortableColumn | null; direction: SortDirection }>({
    column: null,
    direction: null,
  });

  // Handle column visibility toggle
  const toggleColumn = (column: keyof ProjectTableData) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) {
        // Don't allow hiding the name column
        if (column === "name") return prev;
        next.delete(column);
      } else {
        next.add(column);
      }
      return next;
    });
  };

  // Handle sorting
  const handleSort = (column: SortableColumn) => {
    setSortConfig((prev) => {
      if (prev.column !== column) {
        return { column, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column, direction: "desc" };
      }
      return { column: null, direction: null };
    });
  };

  // Sort projects
  const sortedProjects = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return projects;
    }

    return [...projects].sort((a, b) => {
      const { column, direction } = sortConfig;
      let comparison = 0;

      switch (column) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "priority":
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case "account":
          comparison = (a.account || "").localeCompare(b.account || "");
          break;
        case "deadline":
          const aDate = a.deadline ? new Date(a.deadline).getTime() : 0;
          const bDate = b.deadline ? new Date(b.deadline).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case "status":
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }

      return direction === "desc" ? -comparison : comparison;
    });
  }, [projects, sortConfig]);

  // Animation variants for table rows
  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: "easeInOut" as const,
      },
    }),
  };

  const visibleHeaders = allTableHeaders.filter((header) => visibleColumns.has(header.key));

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="relative w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleHeaders.map((header) => (
                <TableHead key={header.key}>
                  {header.sortable ? (
                    <SortableHeader
                      label={header.label}
                      columnKey={header.key as SortableColumn}
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                  ) : (
                    header.label
                  )}
                </TableHead>
              ))}
              {/* Column Toggle in header row */}
              {showColumnToggle && (
                <TableHead className="w-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Settings2 className="h-4 w-4" />
                        <span className="sr-only">Toggle columns</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allTableHeaders.map((header) => (
                        <DropdownMenuCheckboxItem
                          key={header.key}
                          checked={visibleColumns.has(header.key)}
                          onCheckedChange={() => toggleColumn(header.key)}
                          disabled={header.key === "name"}
                        >
                          {header.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
            <TableBody>
              {sortedProjects.length > 0 ? (
                sortedProjects.map((project, index) => {
                  const deadlineInfo = formatDeadline(project.deadline);

                  return (
                    <motion.tr
                      key={project.id}
                      custom={index}
                      initial="hidden"
                      animate="visible"
                      variants={rowVariants}
                      onClick={() => onRowClick?.(project)}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                        onRowClick && "cursor-pointer"
                      )}
                    >
                      {visibleColumns.has("name") && (
                        <TableCell className="font-medium max-w-[200px]">
                          <span className="truncate block">{project.name}</span>
                        </TableCell>
                      )}

                      {visibleColumns.has("workflowStep") && (
                        <TableCell>
                          {project.workflowStep ? (
                            <span className="text-sm text-muted-foreground">{project.workflowStep}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                      )}

                      {visibleColumns.has("priority") && (
                        <TableCell>
                          <Badge className={cn(priorityBadgeVariants({ variant: project.priority }))} aria-label={`Priority: ${project.priority}`}>
                            {project.priority}
                          </Badge>
                        </TableCell>
                      )}

                      {visibleColumns.has("account") && (
                        <TableCell>
                          <span className="text-sm">{project.account || 'Unassigned'}</span>
                        </TableCell>
                      )}

                      {visibleColumns.has("hours") && (
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatHours(project.hours)}</span>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.has("deadline") && (
                        <TableCell>
                          <div className={cn(
                            "flex items-center gap-1.5 text-sm",
                            deadlineInfo.isOverdue && "text-red-600",
                            deadlineInfo.isNear && !deadlineInfo.isOverdue && "text-orange-600",
                            !deadlineInfo.isOverdue && !deadlineInfo.isNear && "text-muted-foreground"
                          )}>
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{deadlineInfo.text}</span>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.has("assignedUsers") && (
                        <TableCell>
                          <div className="flex -space-x-2">
                            {project.assignedUsers.slice(0, 4).map((user) => (
                              <Avatar key={user.id} className="h-7 w-7 border-2 border-background">
                                <AvatarImage src={user.image} alt={user.name} />
                                <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {project.assignedUsers.length > 4 && (
                              <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">+{project.assignedUsers.length - 4}</span>
                              </div>
                            )}
                            {project.assignedUsers.length === 0 && (
                              <span className="text-sm text-muted-foreground/50">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.has("status") && (
                        <TableCell>
                          <Badge className={cn(statusBadgeVariants({ variant: project.status }))} aria-label={`Status: ${formatStatus(project.status)}`}>
                            {formatStatus(project.status)}
                          </Badge>
                        </TableCell>
                      )}
                      {/* Empty cell for settings column */}
                      {showColumnToggle && <TableCell className="w-10" />}
                    </motion.tr>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumns.size + (showColumnToggle ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                    No projects found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
  );
};

// For backwards compatibility, also export with old prop signature
export { ProjectDataTable as default };
