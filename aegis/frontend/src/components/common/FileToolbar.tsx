import React, { memo } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  IconButton,
  InputAdornment,
  Button,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search as SearchIcon,
  Sort as SortIcon,
  CreateNewFolder as CreateNewFolderIcon,
  ContentCut as CutIcon,
  ContentPaste as PasteIcon,
  ViewList as ListViewIcon,
  ViewModule as TileViewIcon,
} from '@mui/icons-material';
import { FileFilterInput } from '../../types';

type SortOption = 'name' | 'date' | 'size';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'tile';

interface FileToolbarProps {
  searchQuery: string;
  sortBy: SortOption;
  sortDirection: SortDirection;
  viewMode: ViewMode;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onToggleSortDirection: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onCreateFolder?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  canCut?: boolean;
  canPaste?: boolean;
  cutItemsCount?: number;
}

const FileToolbar: React.FC<FileToolbarProps> = ({
  searchQuery,
  sortBy,
  sortDirection,
  viewMode,
  onSearchChange,
  onSortChange,
  onToggleSortDirection,
  onViewModeChange,
  onCreateFolder,
  onCut,
  onPaste,
  canCut,
  canPaste,
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
        sx={{ minWidth: 200 }}
      />

      {/* Sort */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Sort by</InputLabel>
        <Select value={sortBy} label="Sort by" onChange={handleSortChange}>
          <Select value="name">Name</Select>
          <Select value="date">Date</Select>
          <Select value="size">Size</Select>
        </Select>
      </FormControl>

      <IconButton onClick={onToggleSortDirection} size="small">
        <SortIcon sx={{
          transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s'
        }} />
      </IconButton>

      {/* Cut and Paste Buttons */}
      <Tooltip title={canCut ? `Cut selected items (${cutItemsCount || 0} selected)` : 'Select items to cut'}>
        <span>
          <IconButton 
            onClick={onCut} 
            size="small" 
            disabled={!canCut}
            color={canCut ? 'primary' : 'default'}
          >
            <CutIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={canPaste ? 'Paste cut items here' : 'No items to paste'}>
        <span>
          <IconButton 
            onClick={onPaste} 
            size="small" 
            disabled={!canPaste}
            color={canPaste ? 'primary' : 'default'}
          >
            <PasteIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* View Mode Toggle */}
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(_, newMode) => newMode && onViewModeChange(newMode)}
        size="small"
      >
        <ToggleButton value="list">
          <ListViewIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="tile">
          <TileViewIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>

      {/* New Folder Button */}
      {onCreateFolder && (
        <Button
          variant="contained"
          startIcon={<CreateNewFolderIcon />}
          onClick={onCreateFolder}
          size="small"
          sx={{ ml: 'auto' }}
        >
          New Folder
        </Button>
      )}
    </Box>
  );
};

export default memo(FileToolbar);