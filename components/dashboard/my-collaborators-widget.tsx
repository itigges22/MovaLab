'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FolderKanban } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { SimpleCounter } from '@/components/ui/animated-counter';
import { fadeInUp, staggerContainer, listItemFadeUp } from '@/lib/animation-variants';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  image?: string;
  role?: string;
  department?: string;
  sharedProjects: number;
  projectNames: string[];
}

interface CollaboratorsResponse {
  success: boolean;
  data: {
    collaborators: Collaborator[];
    totalCollaborators: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-[#007EE5]',
    'bg-[#647878]',
    'bg-[#475250]',
    'bg-[#787878]',
    'bg-[#3D464D]',
    'bg-[#7B8994]',
    'bg-[#282828]',
    'bg-[#3c3c3c]',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Collaborator item component
function CollaboratorItem({
  collaborator,
  index,
}: {
  collaborator: Collaborator;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-all duration-200 group"
    >
      <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
      >
        <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
          {collaborator.image && (
            <AvatarImage src={collaborator.image} alt={collaborator.name} />
          )}
          <AvatarFallback className={cn('text-xs text-white', getAvatarColor(collaborator.name))}>
            {getInitials(collaborator.name)}
          </AvatarFallback>
        </Avatar>
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {collaborator.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {collaborator.role && (
            <span className="truncate">{collaborator.role}</span>
          )}
          {collaborator.role && collaborator.department && (
            <span className="text-muted-foreground/50">·</span>
          )}
          {collaborator.department && (
            <span className="truncate">{collaborator.department}</span>
          )}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 + index * 0.05 }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 bg-muted/50 px-2 py-1 rounded-full"
      >
        <FolderKanban className="h-3 w-3" />
        <span className="tabular-nums">{collaborator.sharedProjects}</span>
      </motion.div>
    </motion.div>
  );
}

// Stacked avatars component
function StackedAvatars({ collaborators }: { collaborators: Collaborator[] }) {
  const displayed = collaborators.slice(0, 5);
  const remaining = collaborators.length - displayed.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {displayed.map((collaborator, index) => (
          <motion.div
            key={collaborator.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <Avatar className="h-8 w-8 ring-2 ring-background">
              {collaborator.image && (
                <AvatarImage src={collaborator.image} alt={collaborator.name} />
              )}
              <AvatarFallback className={cn('text-[10px] text-white', getAvatarColor(collaborator.name))}>
                {getInitials(collaborator.name)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        ))}
        {remaining > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Avatar className="h-8 w-8 ring-2 ring-background bg-muted">
              <AvatarFallback className="text-[10px] font-medium text-muted-foreground">
                +{remaining}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function MyCollaboratorsWidget() {
  const { data, error, isLoading } = useSWR<CollaboratorsResponse>(
    '/api/dashboard/my-collaborators',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              My Collaborators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Failed to load collaborators</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const collaborators = data?.data?.collaborators || [];
  const totalCollaborators = data?.data?.totalCollaborators || 0;
  const uniqueProjects = [...new Set(collaborators.flatMap(c => c.projectNames))].length;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            My Collaborators
            {totalCollaborators > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs font-normal text-muted-foreground"
              >
                (<SimpleCounter value={totalCollaborators} duration={0.8} />)
              </motion.span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {collaborators.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6 text-sm text-muted-foreground"
            >
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No collaborators on active projects
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {/* Stacked avatar preview */}
              <motion.div
                variants={listItemFadeUp}
                className="flex items-center justify-between py-2 border-b"
              >
                <StackedAvatars collaborators={collaborators} />
                <span className="text-xs text-muted-foreground">
                  Working with you this week
                </span>
              </motion.div>

              {/* Collaborator list */}
              <div className="space-y-1">
                {collaborators.slice(0, 5).map((collaborator, index) => (
                  <CollaboratorItem
                    key={collaborator.id}
                    collaborator={collaborator}
                    index={index}
                  />
                ))}
              </div>

              {collaborators.length > 5 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-center text-xs text-muted-foreground py-1"
                >
                  +{collaborators.length - 5} more collaborators
                </motion.p>
              )}

              {/* Summary of projects */}
              {collaborators.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="pt-2 border-t flex items-center justify-between"
                >
                  <p className="text-xs text-muted-foreground">
                    Active projects together
                  </p>
                  <span className="text-xs font-medium tabular-nums">
                    <SimpleCounter value={uniqueProjects} duration={1} />
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default MyCollaboratorsWidget;
