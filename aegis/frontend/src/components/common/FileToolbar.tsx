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
} from '@mui/material';
import {
  Search as SearchIcon,
  Sort as SortIcon,
  CreateNewFolder as CreateNewFolderIcon,
} from '@mui/icons-material';
import { FileFilterInput } from '../../types';

type SortOption = 'name' | 'date' | 'size';
type SortDirection = 'asc' | 'desc';

interface FileToolbarProps {
  filter: FileFilterInput;
  sortBy: SortOption;
  sortDirection: SortDirection;
  onFilterChange: (field: keyof FileFilterInput, value: string) => void;
  onSortChange: (value: SortOption) => void;
  onToggleSortDirection: () => void;
  onCreateFolder?: () => void;
}

const FileToolbar: React.FC<FileToolbarProps> = ({
  filter,
  sortBy,
  sortDirection,
  onFilterChange,
  onSortChange,
  onToggleSortDirection,
  onCreateFolder,
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
        value={filter.filename || ''}
        onChange={(e) => onFilterChange('filename', e.target.value)}
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