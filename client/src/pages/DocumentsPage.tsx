import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  File,
  Star,
  Download,
  Trash2,
  Eye,
  Upload,
  Search,
  LayoutGrid,
  List,
  X,
  HardDrive,
  Kanban,
} from 'lucide-react';
import { api } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { DocumentItem, DocumentStats, DocumentStatus, RelatedEntityType } from '../types/index.js';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(fileType: string) {
  const type = (fileType || '').toLowerCase();
  if (type === 'pdf') {
    return <FileText className="w-5 h-5 text-rose-500" />;
  }
  if (['xlsx', 'xls', 'csv'].includes(type)) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  }
  if (['docx', 'doc', 'txt'].includes(type)) {
    return <FileText className="w-5 h-5 text-blue-500" />;
  }
  if (['pptx', 'ppt'].includes(type)) {
    return <FileText className="w-5 h-5 text-orange-500" />;
  }
  if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(type)) {
    return <ImageIcon className="w-5 h-5 text-indigo-500" />;
  }
  if (['zip', 'rar', 'tar', 'gz'].includes(type)) {
    return <FileArchive className="w-5 h-5 text-amber-500" />;
  }
  return <File className="w-5 h-5 text-muted" />;
}

function getFileTypeBadge(fileType: string) {
  const type = (fileType || 'pdf').toUpperCase();
  const colors: Record<string, string> = {
    PDF: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    DOCX: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    XLSX: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    PPTX: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    PNG: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    JPG: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    ZIP: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };
  return (
    <span
      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
        colors[type] || 'bg-muted/20 text-muted border-border'
      }`}
    >
      {type}
    </span>
  );
}

function getStatusBadge(status: DocumentStatus) {
  const statusStyles: Record<DocumentStatus, { label: string; cls: string }> = {
    approved: {
      label: 'Approved',
      cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    signed: {
      label: 'Signed',
      cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    under_review: {
      label: 'Under Review',
      cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    },
    draft: {
      label: 'Draft',
      cls: 'bg-muted/30 text-muted border-border',
    },
    archived: {
      label: 'Archived',
      cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    },
  };

  const current = statusStyles[status] || statusStyles.draft;
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${current.cls}`}
    >
      {current.label}
    </span>
  );
}

export const DocumentsPage: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Navigation & View State
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [starredOnly, setStarredOnly] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState<boolean>(false);
  const [customFolderName, setCustomFolderName] = useState<string>('');

  // Upload Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    folder: 'Proposals & Quotes',
    fileType: 'pdf',
    fileSize: 0,
    fileData: '',
    version: '1.0',
    status: 'draft' as DocumentStatus,
    tags: '',
    description: '',
    relatedEntityType: 'none' as RelatedEntityType,
    relatedEntityId: '',
    relatedEntityName: '',
  });

  // Query CRM records for linking (Deals & Accounts)
  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-documents'],
    queryFn: async () => {
      const res = await api.get('/deals?limit=50');
      return res.data?.deals || res.data || [];
    },
    enabled: uploadModalOpen,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-for-documents'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=50');
      return res.data?.accounts || res.data || [];
    },
    enabled: uploadModalOpen,
  });

  // Fetch Documents
  const { data, isLoading } = useQuery<{
    documents: DocumentItem[];
    stats: DocumentStats;
  }>({
    queryKey: ['documents', selectedFolder, starredOnly, statusFilter, entityFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFolder !== 'all') params.append('folder', selectedFolder);
      if (starredOnly) params.append('starred', 'true');
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (entityFilter !== 'all') params.append('entityType', entityFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await api.get(`/documents?${params.toString()}`);
      return res.data;
    },
  });

  const documents = data?.documents || [];
  const stats = data?.stats || {
    totalDocuments: 0,
    totalBytes: 0,
    starredCount: 0,
    folders: [],
  };

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/documents', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showToast('Document uploaded successfully to file cabinet', 'success');
      setUploadModalOpen(false);
      resetUploadForm();
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to upload document', 'error');
    },
  });

  // Star Toggle Mutation
  const starMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/documents/${id}/star`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/documents/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showToast('Document deleted successfully', 'success');
      if (previewDoc) setPreviewDoc(null);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to delete document', 'error');
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DocumentStatus }) => {
      const res = await api.put(`/documents/${id}`, { status });
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (previewDoc && previewDoc._id === updated._id) {
        setPreviewDoc(updated);
      }
      showToast('Document status updated', 'success');
    },
  });

  const resetUploadForm = () => {
    setUploadForm({
      name: '',
      folder: selectedFolder !== 'all' ? selectedFolder : 'Proposals & Quotes',
      fileType: 'pdf',
      fileSize: 0,
      fileData: '',
      version: '1.0',
      status: 'draft',
      tags: '',
      description: '',
      relatedEntityType: 'none',
      relatedEntityId: '',
      relatedEntityName: '',
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const reader = new FileReader();
    reader.onload = () => {
      setUploadForm((prev) => ({
        ...prev,
        name: file.name,
        fileType: ext,
        fileSize: file.size,
        fileData: (reader.result as string) || '',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.name.trim()) {
      showToast('Document name is required', 'error');
      return;
    }

    const tagsArray = uploadForm.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    uploadMutation.mutate({
      name: uploadForm.name.trim(),
      folder: uploadForm.folder,
      fileType: uploadForm.fileType,
      fileSize: uploadForm.fileSize || 500000,
      fileData: uploadForm.fileData,
      version: uploadForm.version,
      status: uploadForm.status,
      tags: tagsArray,
      description: uploadForm.description,
      relatedTo: {
        entityType: uploadForm.relatedEntityType,
        entityId: uploadForm.relatedEntityId || undefined,
        entityName: uploadForm.relatedEntityName || undefined,
      },
    });
  };

  const handleDownload = (doc: DocumentItem) => {
    if (doc.fileData && doc.fileData.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = doc.fileData;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Trigger API download count update
      api.get(`/documents/${doc._id}?download=true`).catch(() => {});
      const dummyContent = `Flowdesk CRM Document\nName: ${doc.name}\nFolder: ${doc.folder}\nVersion: ${doc.version}\nStatus: ${doc.status}\nCreated: ${doc.createdAt}`;
      const blob = new Blob([dummyContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    showToast(`Downloading "${doc.name}"`, 'success');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-12">
      {/* ================= LEFT SIDEBAR: FOLDER NAVIGATION TREE (Zoho Docs style) ================= */}
      <div className="w-full lg:w-64 shrink-0 space-y-4">
        {/* Upload Button */}
        <Button
          onClick={() => {
            resetUploadForm();
            setUploadModalOpen(true);
          }}
          className="w-full bg-[#F07B2A] hover:bg-[#d96b20] text-white font-semibold py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </Button>

        {/* Folders List Card */}
        <div className="bg-card border border-border rounded-2xl p-3 shadow-2xs space-y-1">
          <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider">
            <span>File Cabinet</span>
            <button
              onClick={() => setNewFolderModalOpen(true)}
              className="p-1 rounded hover:bg-muted/20 text-[#F07B2A]"
              title="Add New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* All Documents */}
          <button
            onClick={() => {
              setSelectedFolder('all');
              setStarredOnly(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              selectedFolder === 'all' && !starredOnly
                ? 'bg-[#F07B2A]/10 text-[#F07B2A]'
                : 'text-foreground hover:bg-muted/20'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Folder className="w-4 h-4 text-[#F07B2A]" />
              <span>All Documents</span>
            </div>
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted/30 text-muted font-medium">
              {stats.totalDocuments}
            </span>
          </button>

          {/* Starred */}
          <button
            onClick={() => {
              setStarredOnly(true);
              setSelectedFolder('all');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              starredOnly
                ? 'bg-amber-500/10 text-amber-600'
                : 'text-foreground hover:bg-muted/20'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Starred Files</span>
            </div>
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted/30 text-muted font-medium">
              {stats.starredCount}
            </span>
          </button>

          <div className="pt-2 pb-1 px-3">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
              Categories
            </span>
          </div>

          {/* Folder items */}
          {stats.folders.map((f) => (
            <button
              key={f.name}
              onClick={() => {
                setSelectedFolder(f.name);
                setStarredOnly(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                selectedFolder === f.name && !starredOnly
                  ? 'bg-[#F07B2A]/10 text-[#F07B2A]'
                  : 'text-foreground hover:bg-muted/20'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                {selectedFolder === f.name ? (
                  <FolderOpen className="w-4 h-4 text-[#F07B2A] shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-muted shrink-0" />
                )}
                <span className="truncate">{f.name}</span>
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted/30 text-muted font-medium shrink-0">
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Storage Meter Card (Zoho style) */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-muted" />
              <span>Storage Quota</span>
            </div>
            <span className="text-muted font-normal text-[11px]">
              {formatBytes(stats.totalBytes)} / 5.0 GB
            </span>
          </div>
          <div className="w-full bg-muted/30 h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#F07B2A] h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(
                  3,
                  Math.min(100, (stats.totalBytes / (5 * 1024 * 1024 * 1024)) * 100)
                )}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>{stats.totalDocuments} total documents</span>
            <span className="text-emerald-600 font-semibold">Healthy</span>
          </div>
        </div>
      </div>

      {/* ================= RIGHT MAIN AREA: DOCUMENT BROWSER & LIST ================= */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* Top Control Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                {starredOnly
                  ? 'Starred Documents'
                  : selectedFolder === 'all'
                  ? 'All Documents'
                  : selectedFolder}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/30 text-muted font-medium">
                {documents.length} files
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Sales collateral, executed proposals, pitch decks & customer agreements
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted" />
              <input
                type="text"
                placeholder="Search files or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-muted/20 border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#F07B2A] w-48"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-muted/20 border border-border rounded-xl px-2.5 py-1.5 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="signed">Signed</option>
              <option value="under_review">Under Review</option>
              <option value="draft">Draft</option>
            </select>

            {/* Entity Filter */}
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="text-xs bg-muted/20 border border-border rounded-xl px-2.5 py-1.5 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
            >
              <option value="all">All Linked Records</option>
              <option value="deal">Deals</option>
              <option value="account">Accounts</option>
              <option value="lead">Leads</option>
            </select>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted/20 border border-border rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-card text-foreground shadow-2xs'
                    : 'text-muted hover:text-foreground'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-card text-foreground shadow-2xs'
                    : 'text-muted hover:text-foreground'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Display: Empty State or Grid / List */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted bg-card border border-border rounded-2xl">
            Loading sales documents cabinet...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F07B2A]/10 text-[#F07B2A] flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">No documents found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'No documents matched your query. Try adjusting your search or filters.'
                  : 'This folder is currently empty. Upload sales proposals, contracts, and collateral.'}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                resetUploadForm();
                setUploadModalOpen(true);
              }}
              className="bg-[#F07B2A] text-white hover:bg-[#d96b20] text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload First Document
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ================= GRID VIEW ================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="bg-card border border-border rounded-2xl p-4.5 shadow-2xs hover:border-[#F07B2A]/40 transition-all flex flex-col justify-between group relative"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center shrink-0 border border-border/40">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {getFileTypeBadge(doc.fileType)}
                          <span className="text-[10px] text-muted font-semibold">
                            v{doc.version || '1.0'}
                          </span>
                        </div>
                        <span className="text-xs text-muted truncate block">
                          {formatBytes(doc.fileSize)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => starMutation.mutate(doc._id)}
                        className="p-1 rounded-lg text-muted hover:text-amber-500 transition-colors"
                        title={doc.isStarred ? 'Unstar' : 'Star file'}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            doc.isStarred ? 'text-amber-500 fill-amber-500' : ''
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1 rounded-lg text-muted hover:text-foreground transition-colors"
                        title="Document Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h4
                    onClick={() => setPreviewDoc(doc)}
                    className="text-xs font-bold text-foreground hover:text-[#F07B2A] transition-colors cursor-pointer line-clamp-2 mb-2"
                  >
                    {doc.name}
                  </h4>

                  {/* Description preview */}
                  {doc.description && (
                    <p className="text-[11px] text-muted line-clamp-2 mb-2.5">
                      {doc.description}
                    </p>
                  )}

                  {/* Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {doc.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-muted/30 text-muted"
                        >
                          #{tag}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-[9px] text-muted font-bold">
                          +{doc.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Meta & Actions */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted mt-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.status)}
                    {doc.relatedTo && doc.relatedTo.entityType !== 'none' && (
                      <span className="text-[10px] text-muted font-medium truncate max-w-[100px]">
                        • {doc.relatedTo.entityName || doc.relatedTo.entityType}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded-lg bg-muted/20 hover:bg-[#F07B2A]/10 text-muted hover:text-[#F07B2A] transition-colors"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {(isAdmin || isManager) && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete document "${doc.name}"?`)) {
                            deleteMutation.mutate(doc._id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-muted/20 hover:bg-rose-500/10 text-muted hover:text-rose-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ================= LIST VIEW (Zoho CRM Classic Table) ================= */
          <div className="bg-card border border-border rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted font-medium bg-muted/10">
                  <tr>
                    <th className="py-3 px-4 w-8"></th>
                    <th className="py-3 px-3">File Name</th>
                    <th className="py-3 px-3">Folder</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Size</th>
                    <th className="py-3 px-3">Linked Record</th>
                    <th className="py-3 px-3">Uploaded By</th>
                    <th className="py-3 px-3">Modified</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {documents.map((doc) => (
                    <tr key={doc._id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => starMutation.mutate(doc._id)}
                          className="text-muted hover:text-amber-500"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              doc.isStarred ? 'text-amber-500 fill-amber-500' : ''
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0">{getFileIcon(doc.fileType)}</div>
                          <div className="min-w-0">
                            <span
                              onClick={() => setPreviewDoc(doc)}
                              className="font-bold text-foreground hover:text-[#F07B2A] transition-colors cursor-pointer truncate block max-w-xs"
                            >
                              {doc.name}
                            </span>
                            <span className="text-[10px] text-muted">v{doc.version}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted">{doc.folder}</td>
                      <td className="py-3 px-3">{getStatusBadge(doc.status)}</td>
                      <td className="py-3 px-3 text-muted">{formatBytes(doc.fileSize)}</td>
                      <td className="py-3 px-3 text-muted truncate max-w-[120px]">
                        {doc.relatedTo && doc.relatedTo.entityType !== 'none'
                          ? doc.relatedTo.entityName || doc.relatedTo.entityType
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-muted truncate max-w-[120px]">
                        {doc.uploadedBy?.name || 'User'}
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-1 rounded hover:bg-muted/20 text-muted hover:text-[#F07B2A]"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1 rounded hover:bg-muted/20 text-muted hover:text-foreground"
                            title="Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {(isAdmin || isManager) && (
                            <button
                              onClick={() => {
                                if (confirm(`Delete document "${doc.name}"?`)) {
                                  deleteMutation.mutate(doc._id);
                                }
                              }}
                              className="p-1 rounded hover:bg-rose-500/10 text-muted hover:text-rose-600"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ================= UPLOAD DOCUMENT MODAL (Zoho CRM style) ================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#F07B2A]">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Upload Document</h3>
                  <p className="text-xs text-muted">Store proposal, contract, or sales collateral</p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-[#F07B2A] rounded-2xl p-5 text-center cursor-pointer bg-muted/10 transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.txt"
                />
                <div className="w-10 h-10 rounded-xl bg-[#F07B2A]/10 text-[#F07B2A] flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-foreground">
                  {uploadForm.name ? uploadForm.name : 'Click to select or drag and drop a file'}
                </div>
                <p className="text-[11px] text-muted mt-0.5">
                  PDF, DOCX, XLSX, PPTX, Images or ZIP (Max 10MB)
                </p>
                {uploadForm.fileSize > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-600 block mt-1">
                    Selected size: {formatBytes(uploadForm.fileSize)}
                  </span>
                )}
              </div>

              {/* Document Name */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">
                  Document Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  placeholder="e.g. Master Services Agreement 2026.pdf"
                  className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                />
              </div>

              {/* Folder & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Folder Category
                  </label>
                  <select
                    value={uploadForm.folder}
                    onChange={(e) => setUploadForm({ ...uploadForm, folder: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  >
                    <option value="Proposals & Quotes">Proposals & Quotes</option>
                    <option value="Contracts & NDAs">Contracts & NDAs</option>
                    <option value="Pitch Decks & Presentations">Pitch Decks & Presentations</option>
                    <option value="Product Collateral">Product Collateral</option>
                    <option value="Customer Case Studies">Customer Case Studies</option>
                    <option value="Legal & Compliance">Legal & Compliance</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Status
                  </label>
                  <select
                    value={uploadForm.status}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, status: e.target.value as DocumentStatus })
                    }
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  >
                    <option value="draft">Draft</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="signed">Signed</option>
                  </select>
                </div>
              </div>

              {/* Link to CRM Record (Zoho CRM Integration) */}
              <div className="p-3 bg-muted/15 border border-border rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  Link to CRM Record (Optional)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={uploadForm.relatedEntityType}
                    onChange={(e) =>
                      setUploadForm({
                        ...uploadForm,
                        relatedEntityType: e.target.value as RelatedEntityType,
                        relatedEntityId: '',
                        relatedEntityName: '',
                      })
                    }
                    className="px-2.5 py-1.5 text-xs bg-muted/20 border border-border rounded-lg text-foreground font-medium focus:outline-none"
                  >
                    <option value="none">No Link</option>
                    <option value="deal">Deal</option>
                    <option value="account">Account</option>
                  </select>

                  {uploadForm.relatedEntityType === 'deal' && (
                    <select
                      value={uploadForm.relatedEntityId}
                      onChange={(e) => {
                        const found = (deals as any[]).find((d) => d._id === e.target.value);
                        setUploadForm({
                          ...uploadForm,
                          relatedEntityId: e.target.value,
                          relatedEntityName: found?.title || '',
                        });
                      }}
                      className="px-2.5 py-1.5 text-xs bg-muted/20 border border-border rounded-lg text-foreground font-medium focus:outline-none"
                    >
                      <option value="">Select Deal...</option>
                      {(deals as any[]).map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {uploadForm.relatedEntityType === 'account' && (
                    <select
                      value={uploadForm.relatedEntityId}
                      onChange={(e) => {
                        const found = (accounts as any[]).find((a) => a._id === e.target.value);
                        setUploadForm({
                          ...uploadForm,
                          relatedEntityId: e.target.value,
                          relatedEntityName: found?.name || '',
                        });
                      }}
                      className="px-2.5 py-1.5 text-xs bg-muted/20 border border-border rounded-lg text-foreground font-medium focus:outline-none"
                    >
                      <option value="">Select Account...</option>
                      {(accounts as any[]).map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Version & Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Version</label>
                  <input
                    type="text"
                    value={uploadForm.version}
                    onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    placeholder="e.g. Enterprise, Reliance, NDA"
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Additional notes about document scope or terms..."
                  className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#F07B2A] text-white hover:bg-[#d96b20]"
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Save & Upload'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DOCUMENT DETAIL / PREVIEW MODAL ================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center border border-border/40">
                  {getFileIcon(previewDoc.fileType)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground line-clamp-1">
                    {previewDoc.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                    <span>{previewDoc.folder}</span>
                    <span>•</span>
                    <span>v{previewDoc.version}</span>
                    <span>•</span>
                    <span>{formatBytes(previewDoc.fileSize)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/10 p-3.5 rounded-xl border border-border">
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Status</span>
                <div className="mt-1">{getStatusBadge(previewDoc.status)}</div>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">
                  Uploaded By
                </span>
                <span className="font-semibold text-foreground mt-1 block">
                  {previewDoc.uploadedBy?.name || 'User'}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">
                  Upload Date
                </span>
                <span className="font-semibold text-foreground mt-1 block">
                  {new Date(previewDoc.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Downloads</span>
                <span className="font-semibold text-foreground mt-1 block">
                  {previewDoc.downloadCount || 0} times
                </span>
              </div>
            </div>

            {/* Linked Entity */}
            {previewDoc.relatedTo && previewDoc.relatedTo.entityType !== 'none' && (
              <div className="p-3 rounded-xl bg-muted/15 border border-border text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted">
                  <Kanban className="w-4 h-4 text-[#F07B2A]" />
                  <span>Linked CRM Record:</span>
                  <span className="font-bold text-foreground">
                    {previewDoc.relatedTo.entityName || previewDoc.relatedTo.entityType}
                  </span>
                </div>
                {previewDoc.relatedTo.entityType === 'deal' && previewDoc.relatedTo.entityId && (
                  <Link
                    to={`/deals/${previewDoc.relatedTo.entityId}`}
                    className="text-[#F07B2A] hover:underline font-semibold text-[11px]"
                  >
                    Open Deal →
                  </Link>
                )}
              </div>
            )}

            {/* Description */}
            {previewDoc.description && (
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                  Notes / Overview
                </span>
                <p className="text-xs text-muted bg-muted/10 p-3 rounded-xl border border-border">
                  {previewDoc.description}
                </p>
              </div>
            )}

            {/* Status Change Selector */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted font-medium">Update Status:</span>
                <select
                  value={previewDoc.status}
                  onChange={(e) =>
                    updateStatusMutation.mutate({
                      id: previewDoc._id,
                      status: e.target.value as DocumentStatus,
                    })
                  }
                  className="px-2 py-1 text-xs bg-muted/20 border border-border rounded-lg text-foreground font-semibold"
                >
                  <option value="draft">Draft</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="signed">Signed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleDownload(previewDoc)}
                  className="bg-[#F07B2A] text-white hover:bg-[#d96b20] text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download File
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= CREATE NEW FOLDER MODAL ================= */}
      {newFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#F07B2A]" />
                <h3 className="text-sm font-bold text-foreground">Create Folder</h3>
              </div>
              <button
                onClick={() => setNewFolderModalOpen(false)}
                className="p-1 rounded text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted block mb-1">Folder Name</label>
              <input
                type="text"
                placeholder="e.g. Compliance Documents"
                value={customFolderName}
                onChange={(e) => setCustomFolderName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewFolderModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!customFolderName.trim()) return;
                  setSelectedFolder(customFolderName.trim());
                  setNewFolderModalOpen(false);
                  setCustomFolderName('');
                  showToast(`Switched to folder "${customFolderName.trim()}"`, 'success');
                }}
                className="bg-[#F07B2A] text-white hover:bg-[#d96b20]"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
