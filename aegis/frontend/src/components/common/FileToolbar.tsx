import React, { memo } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  MenuItem,
  IconButton,
  InputAdornment,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Sort as SortIcon,
  CreateNewFolder as CreateNewFolderIcon,
  ContentCut as CutIcon,
  ContentPaste as PasteIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
} from '@mui/icons-material';

type SortOption = 'name' | 'date' | 'size' | 'type';
type SortDirection = 'asc' | 'desc';

interface FileToolbarProps {
  searchQuery: string;
  sortBy: SortOption;
  sortDirection: SortDirection;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onToggleSortDirection: () => void;
  onCreateFolder?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onStar?: () => void;
  canCut?: boolean;
  canPaste?: boolean;
  canDelete?: boolean;
  canStar?: boolean;
  cutItemsCount?: number;
}

const FileToolbar: React.FC<FileToolbarProps> = ({
  searchQuery,
  sortBy,
  sortDirection,
  onSearchChange,
  onSortChange,
  onToggleSortDirection,
  onCreateFolder,
  onCut,
  onPaste,
  onDelete,
  onStar,
  canCut,
  canPaste,
  canDelete,
  canStar,
  cutItemsCount,
}) => {
  const handleSortChange = (event: SelectChangeEvent) => {
    onSortChange(event.target.value as SortOption);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
      {/* Search */}
      <TextField
        size="small"
        placeholder="Search files..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: 450 }}
      />

      {/* Sort */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Sort by</InputLabel>
        <Select value={sortBy} label="Sort by" onChange={handleSortChange}>
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="date">Date</MenuItem>
          <MenuItem value="size">Size</MenuItem>
          <MenuItem value="type">Type</MenuItem>
        </Select>
      </FormControl>

      <IconButton onClick={onToggleSortDirection} size="small">
        <SortIcon sx={{
          transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s'
        }} />
      </IconButton>


      {/* Spacer to push action buttons to the right */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Action Buttons - shown only when items are selected */}
      {canCut && (
        <Tooltip title={`Cut selected items (${cutItemsCount || 0} selected)`}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onCut?.();
            }}
            size="small"
            color="primary"
          >
            <CutIcon />
          </IconButton>
        </Tooltip>
      )}

      {canDelete && (
        <Tooltip title="Delete selected items">
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            size="small"
            color="primary"
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      )}

      {canStar && (
        <Tooltip title="Star selected items">
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onStar?.();
            }}
            size="small"
            color="primary"
          >
            <StarIcon />
          </IconButton>
        </Tooltip>
      )}

      {canPaste && (
        <Tooltip title="Paste items here">
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onPaste?.();
            }}
            size="small"
            color="primary"
          >
            <PasteIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* New Folder Button */}
      {onCreateFolder && (
        <Button
          variant="contained"
          startIcon={<CreateNewFolderIcon />}
          onClick={onCreateFolder}
          size="small"
        >
          New Folder
        </Button>
      )}
    </Box>
  );
};

export default memo(FileToolbar);