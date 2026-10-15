import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Calendar,
  Clock,
  Trash2,
  Bell,
  Briefcase,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';

import { theme } from '../../../src/theme';
import { AppBar } from '../../../src/components/AppBar';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { showToast } from '../../../src/components/Toast';
import { enqueueOfflineMutation } from '../../../src/offline/mutationQueue';
import { PressableScale } from '../../../src/animations/PressableScale';
import { UnderlineTabs } from '../../../src/animations/UnderlineTabs';
import { Checkbox } from '../../../src/animations/Checkbox';
import { Skeleton } from '../../../src/animations/Skeleton';
import { ScreenEntrance } from '../../../src/animations/ScreenEntrance';
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../../../src/api/tasks';
import { fetchDeals } from '../../../src/api/deals';
import { queryKeys } from '../../../src/api/queryKeys';
import { useIsRowHighlighted } from '../../../src/realtime/highlightStore';
import { Task, TaskType, TaskPriority } from '@flowdesk/shared';

const TASK_TABS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
];

const TASK_TYPES: { key: TaskType; label: string }[] = [
  { key: 'call', label: 'Call' },
  { key: 'email', label: 'Email' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'document', label: 'Document' },
  { key: 'todo', label: 'Todo' },
];

const PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
];

function TaskItemRow({
  task,
  onToggle,
  onSnooze,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onSnooze: () => void;
  onDelete: () => void;
}) {
  const isHighlighted = useIsRowHighlighted(task._id);
  const highlightProgress = useSharedValue(0);

  useEffect(() => {
    if (isHighlighted) {
      highlightProgress.value = 1;
      highlightProgress.value = withTiming(0, {
        duration: 1200,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [isHighlighted, highlightProgress]);

  const animatedHighlightStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      highlightProgress.value,
      [0, 1],
      [theme.colors.surface, 'rgba(34, 160, 107, 0.12)']
    );
    const borderColor = interpolateColor(
      highlightProgress.value,
      [0, 1],
      [theme.colors.border, theme.colors.green]
    );
    return {
      backgroundColor,
      borderColor,
    };
  });

  const isDone = task.status === 'done';
  const dueDate = new Date(task.dueDate);
  const now = new Date();
  const isOverdue = !isDone && dueDate < now;

  const dealTitle =
    typeof task.deal === 'object' && task.deal ? task.deal.title : null;
  const subtitle = [dealTitle, task.type ? task.type.toUpperCase() : 'TODO']
    .filter(Boolean)
    .join(' · ');

  // Time format
  const timeStr = dueDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Animated.View style={[styles.taskRow, animatedHighlightStyle]}>
      {/* 1. Animated Checkbox */}
      <View style={styles.checkboxContainer}>
        <Checkbox checked={isDone} onToggle={onToggle} size={24} />
      </View>

      {/* 2. Title & Subtitle */}
      <View style={styles.taskCenter}>
        <Text
          style={[
            styles.taskTitle,
            isDone && styles.taskTitleDone,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        <Text style={styles.taskSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {/* 3. Right Status / Time */}
      <View style={styles.taskRight}>
        {isOverdue ? (
          <Badge label="Overdue" variant="hot" />
        ) : (
          <Text style={styles.taskTime}>{timeStr}</Text>
        )}

        <View style={styles.taskActions}>
          <PressableScale
            onPress={onSnooze}
            style={styles.actionBtn}
            accessibilityLabel="Snooze 1 day"
          >
            <Clock size={14} color={theme.colors.muted} />
          </PressableScale>

          <PressableScale
            onPress={onDelete}
            style={styles.actionBtn}
            accessibilityLabel="Delete task"
          >
            <Trash2 size={14} color={theme.colors.ratings.hot.text} />
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
}

function TasksSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <Skeleton width="100%" height={80} style={{ borderRadius: theme.radii.card, marginBottom: 16 }} />
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={24} height={24} style={{ borderRadius: 12, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Skeleton width="65%" height={16} style={{ borderRadius: 4, marginBottom: 6 }} />
            <Skeleton width="40%" height={12} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton width={60} height={20} style={{ borderRadius: 6 }} />
        </View>
      ))}
    </View>
  );
}

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'overdue'>('today');
  const [createSheetVisible, setCreateSheetVisible] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<TaskType>('call');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newDaysAhead, setNewDaysAhead] = useState(0); // 0 = today, 1 = tomorrow, 7 = next week
  const [selectedDealId, setSelectedDealId] = useState<string>('');

  // 1. Fetch Tasks
  const {
    data: tasksData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.tasks.list({ limit: 100 }),
    queryFn: () => fetchTasks({ limit: 100 }),
  });

  // 2. Fetch Deals for picker
  const { data: dealsData } = useQuery({
    queryKey: queryKeys.deals.list({ limit: 50 }),
    queryFn: () => fetchDeals({ limit: 50 }),
    enabled: createSheetVisible,
  });

  const allTasks = useMemo(() => tasksData?.data || [], [tasksData]);

  // Tab Filtering & Progress
  const { todayTasks, upcomingTasks, overdueTasks, doneTodayCount, totalTodayCount, progressPercent } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const today: Task[] = [];
    const upcoming: Task[] = [];
    const overdue: Task[] = [];

    allTasks.forEach((t) => {
      const d = new Date(t.dueDate);
      if (t.status === 'done') {
        if (d >= todayStart && d <= todayEnd) {
          today.push(t);
        }
      } else {
        if (d < todayStart) {
          overdue.push(t);
        } else if (d <= todayEnd) {
          today.push(t);
        } else {
          upcoming.push(t);
        }
      }
    });

    const doneCount = today.filter((t) => t.status === 'done').length;
    const totalCount = today.length;
    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return {
      todayTasks: today,
      upcomingTasks: upcoming,
      overdueTasks: overdue,
      doneTodayCount: doneCount,
      totalTodayCount: totalCount,
      progressPercent: pct,
    };
  }, [allTasks]);

  // Current display list
  const currentList =
    activeTab === 'today'
      ? todayTasks
      : activeTab === 'upcoming'
      ? upcomingTasks
      : overdueTasks;

  // Optimistic Toggle Mutation (Works Offline!)
  const toggleMutation = useMutation({
    mutationFn: ({ taskId, currentStatus }: { taskId: string; currentStatus: 'open' | 'done' }) => {
      const newStatus = currentStatus === 'open' ? 'done' : 'open';
      return updateTask(taskId, { status: newStatus });
    },
    onMutate: async ({ taskId, currentStatus }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const prevData = queryClient.getQueryData<any>(queryKeys.tasks.list({ limit: 100 }));

      if (prevData?.data) {
        const nextStatus = currentStatus === 'open' ? 'done' : 'open';
        queryClient.setQueryData(queryKeys.tasks.list({ limit: 100 }), {
          ...prevData,
          data: prevData.data.map((t: Task) =>
            t._id === taskId ? { ...t, status: nextStatus } : t
          ),
        });
      }
      return { prevData };
    },
    onError: async (err: any, vars, context) => {
      // If network failure / offline, queue mutation for background replay
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        const nextStatus = vars.currentStatus === 'open' ? 'done' : 'open';
        await enqueueOfflineMutation({
          type: 'COMPLETE_TASK',
          endpoint: `/tasks/${vars.taskId}`,
          method: 'PATCH',
          payload: { status: nextStatus },
          entityType: 'task',
          entityId: vars.taskId,
          description: `Task ${nextStatus === 'done' ? 'completed' : 'reopened'}`,
        });
        return;
      }
      if (context?.prevData) {
        queryClient.setQueryData(queryKeys.tasks.list({ limit: 100 }), context.prevData);
      }
      showToast('Could not update task. Rolled back.', { type: 'error' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });

  // Snooze Task Mutation
  const snoozeMutation = useMutation({
    mutationFn: ({ taskId, currentDue }: { taskId: string; currentDue: string | Date }) => {
      const nextDate = new Date(new Date(currentDue).getTime() + 24 * 60 * 60 * 1000);
      return updateTask(taskId, { dueDate: nextDate.toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      showToast('Task snoozed by 1 day', { type: 'success' });
    },
  });

  // Delete Task Mutation
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      showToast('Task deleted', { type: 'success' });
    },
    onError: () => {
      showToast('Only Admins and Managers can delete tasks', { type: 'error' });
    },
  });

  // Create Task Mutation
  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      setCreateSheetVisible(false);
      setNewTitle('');
      setSelectedDealId('');
      showToast('Task created', { type: 'success' });
    },
    onError: async (err: any, vars) => {
      if (!err?.response || err?.message === 'Network Error' || err?.code === 'ECONNABORTED') {
        await enqueueOfflineMutation({
          type: 'CREATE_TASK',
          endpoint: '/tasks',
          method: 'POST',
          payload: vars,
          entityType: 'task',
          description: `Task "${vars.title}"`,
        });
        setCreateSheetVisible(false);
        setNewTitle('');
        setSelectedDealId('');
        return;
      }
      showToast(err.message || 'Failed to create task', { type: 'error' });
    },
  });

  const handleCreateTask = () => {
    if (!newTitle.trim()) {
      showToast('Please enter a task title', { type: 'error' });
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + newDaysAhead);
    dueDate.setHours(17, 0, 0, 0); // 5:00 PM

    createMutation.mutate({
      title: newTitle.trim(),
      status: 'open',
      type: newType,
      priority: newPriority,
      dueDate: dueDate.toISOString(),
      deal: selectedDealId || undefined,
      description: '',
    });
  };

  return (
    <View style={styles.container}>
      {/* Green App Bar */}
      <AppBar
        title="Tasks"
        backgroundColor={theme.colors.appBar.tasks}
        showBack
        rightAction={
          <PressableScale
            onPress={() => setCreateSheetVisible(true)}
            style={styles.addBtn}
            accessibilityLabel="Create task"
          >
            <Plus size={18} color={theme.colors.appBar.tasks} />
          </PressableScale>
        }
      />

      {/* Tabs: Today, Upcoming, Overdue */}
      <View style={styles.tabsWrapper}>
        <UnderlineTabs
          tabs={TASK_TABS}
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as any)}
          activeColor={theme.colors.green}
        />
      </View>

      <ScreenEntrance style={styles.content}>
        {isLoading ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <TasksSkeleton />
          </ScrollView>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <ErrorState
              title="Unable to load tasks"
              message={(error as Error)?.message || 'Check network connection.'}
              onRetry={() => refetch()}
            />
          </View>
        ) : (
          <View style={styles.listWrapper}>
            {/* Today's Progress Card (Shown on Today tab) */}
            {activeTab === 'today' && (
              <Card style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>Today's progress</Text>
                  <Text style={styles.progressCount}>
                    {doneTodayCount} of {totalTodayCount} done
                  </Text>
                </View>
                <ProgressBar
                  progress={progressPercent}
                  color={theme.colors.green}
                  height={8}
                />
              </Card>
            )}

            {currentList.length === 0 ? (
              <EmptyState
                title={
                  activeTab === 'today'
                    ? 'No tasks for today'
                    : activeTab === 'upcoming'
                    ? 'No upcoming tasks'
                    : 'Zero overdue tasks 🎉'
                }
                description={
                  activeTab === 'today'
                    ? 'You have completed all scheduled tasks for today!'
                    : activeTab === 'upcoming'
                    ? 'Schedule future follow-ups or meetings using the + button.'
                    : 'Great job staying on top of follow-ups and client commitments!'
                }
              />
            ) : (
              <FlashList
                data={currentList}
                keyExtractor={(item) => item._id}
                estimatedItemSize={76}
                contentContainerStyle={styles.flashListContent}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={() => refetch()}
                    tintColor={theme.colors.green}
                  />
                }
                renderItem={({ item }) => (
                  <TaskItemRow
                    task={item}
                    onToggle={() =>
                      toggleMutation.mutate({
                        taskId: item._id,
                        currentStatus: item.status,
                      })
                    }
                    onSnooze={() =>
                      snoozeMutation.mutate({
                        taskId: item._id,
                        currentDue: item.dueDate,
                      })
                    }
                    onDelete={() => {
                      if (Platform.OS === 'web') {
                        if (typeof window !== 'undefined' && window.confirm('Delete this task permanently?')) {
                          deleteMutation.mutate(item._id);
                        }
                        return;
                      }
                      Alert.alert('Delete Task', 'Delete this task permanently?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => deleteMutation.mutate(item._id),
                        },
                      ]);
                    }}
                  />
                )}
              />
            )}
          </View>
        )}
      </ScreenEntrance>

      {/* Add Task Bottom Sheet */}
      <BottomSheet
        visible={createSheetVisible}
        onClose={() => setCreateSheetVisible(false)}
        title="Add New Task"
      >
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <Text style={styles.inputLabel}>Task Title *</Text>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="e.g. Call Kavya Nair about contract"
            placeholderTextColor={theme.colors.muted}
            style={styles.textInput}
          />

          {/* Type Selector */}
          <Text style={styles.inputLabel}>Task Type</Text>
          <View style={styles.chipRow}>
            {TASK_TYPES.map((t) => (
              <PressableScale
                key={t.key}
                onPress={() => setNewType(t.key)}
                style={[
                  styles.selectorChip,
                  newType === t.key && styles.selectorChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    newType === t.key && styles.selectorChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Priority */}
          <Text style={styles.inputLabel}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p) => (
              <PressableScale
                key={p.key}
                onPress={() => setNewPriority(p.key)}
                style={[
                  styles.selectorChip,
                  newPriority === p.key && styles.selectorChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    newPriority === p.key && styles.selectorChipTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Due Schedule */}
          <Text style={styles.inputLabel}>Due Date</Text>
          <View style={styles.chipRow}>
            {[
              { days: 0, label: 'Today' },
              { days: 1, label: 'Tomorrow' },
              { days: 3, label: 'In 3 Days' },
              { days: 7, label: 'Next Week' },
            ].map((schedule) => (
              <PressableScale
                key={schedule.days}
                onPress={() => setNewDaysAhead(schedule.days)}
                style={[
                  styles.selectorChip,
                  newDaysAhead === schedule.days && styles.selectorChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    newDaysAhead === schedule.days && styles.selectorChipTextActive,
                  ]}
                >
                  {schedule.label}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Link to Deal (Optional) */}
          {dealsData?.data && dealsData.data.length > 0 && (
            <>
              <Text style={styles.inputLabel}>Related Deal (Optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dealChipsScroll}
              >
                <PressableScale
                  onPress={() => setSelectedDealId('')}
                  style={[
                    styles.selectorChip,
                    selectedDealId === '' && styles.selectorChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      selectedDealId === '' && styles.selectorChipTextActive,
                    ]}
                  >
                    None
                  </Text>
                </PressableScale>
                {dealsData.data.slice(0, 8).map((d) => (
                  <PressableScale
                    key={d._id}
                    onPress={() => setSelectedDealId(d._id)}
                    style={[
                      styles.selectorChip,
                      selectedDealId === d._id && styles.selectorChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectorChipText,
                        selectedDealId === d._id && styles.selectorChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {d.title}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </>
          )}

          {/* Save Button */}
          <PressableScale
            onPress={handleCreateTask}
            style={styles.saveBtn}
            accessibilityLabel="Save Task"
          >
            <Text style={styles.saveBtnText}>Save Task</Text>
          </PressableScale>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrapper: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 12,
  },
  scrollContent: {
    padding: theme.spacing.screen,
  },
  progressCard: {
    padding: 16,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  progressCount: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.green,
  },
  flashListContent: {
    paddingBottom: 90,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.listRow,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  taskCenter: {
    flex: 1,
    marginRight: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 3,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: theme.colors.muted,
  },
  taskSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.muted,
  },
  taskRight: {
    alignItems: 'flex-end',
  },
  taskTime: {
    fontSize: 12,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.text2,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
  skeletonContainer: {
    gap: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.listRow,
    padding: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.screen,
  },
  sheetScroll: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: theme.typography.families.regular,
    color: theme.colors.ink,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dealChipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  selectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.chip,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectorChipActive: {
    backgroundColor: theme.colors.green,
    borderColor: theme.colors.green,
  },
  selectorChipText: {
    fontSize: 13,
    fontFamily: theme.typography.families.medium,
    color: theme.colors.ink,
  },
  selectorChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: theme.colors.green,
    borderRadius: theme.radii.input,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.typography.families.bold,
    fontWeight: '700',
  },
});
