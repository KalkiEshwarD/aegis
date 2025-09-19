import React from 'react';
import { render } from '@testing-library/react';

// Mock Material-UI icons
jest.mock('@mui/icons-material', () => ({
  InsertDriveFile: () => <div data-testid="file-icon">FileIcon</div>,
  Image: () => <div data-testid="image-icon">ImageIcon</div>,
  VideoFile: () => <div data-testid="video-icon">VideoIcon</div>,
  AudioFile: () => <div data-testid="audio-icon">AudioIcon</div>,
  PictureAsPdf: () => <div data-testid="pdf-icon">PdfIcon</div>,
  Archive: () => <div data-testid="archive-icon">ArchiveIcon</div>,
  Code: () => <div data-testid="code-icon">CodeIcon</div>,
  Description: () => <div data-testid="document-icon">DocumentIcon</div>,
}));

import { getFileIcon, formatFileSize, getMimeTypeFromExtension } from '../../utils/fileUtils';

describe('File Utils', () => {
  describe('getFileIcon', () => {
    it('should return image icon for image files', () => {
      const { getByTestId } = render(getFileIcon('image/jpeg', 'test.jpg'));
      expect(getByTestId('image-icon')).toBeInTheDocument();
    });

    it('should return video icon for video files', () => {
      const { getByTestId } = render(getFileIcon('video/mp4', 'test.mp4'));
      expect(getByTestId('video-icon')).toBeInTheDocument();
    });

    it('should return audio icon for audio files', () => {
      const { getByTestId } = render(getFileIcon('audio/mpeg', 'test.mp3'));
      expect(getByTestId('audio-icon')).toBeInTheDocument();
    });

    it('should return PDF icon for PDF files', () => {
      const { getByTestId } = render(getFileIcon('application/pdf', 'test.pdf'));
      expect(getByTestId('pdf-icon')).toBeInTheDocument();
    });

    it('should return archive icon for archive files', () => {
      const { getByTestId } = render(getFileIcon('application/zip', 'test.zip'));
      expect(getByTestId('archive-icon')).toBeInTheDocument();
    });

    it('should return code icon for code files', () => {
      const { getByTestId } = render(getFileIcon('text/plain', 'test.js'));
      expect(getByTestId('code-icon')).toBeInTheDocument();
    });

    it('should return document icon for document files', () => {
      const { getByTestId } = render(getFileIcon('text/plain', 'test.txt'));
      expect(getByTestId('document-icon')).toBeInTheDocument();
    });

    it('should return default file icon for unknown files', () => {
      const { getByTestId } = render(getFileIcon('application/octet-stream', 'test.unknown'));
      expect(getByTestId('file-icon')).toBeInTheDocument();
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should format terabytes', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });

    it('should handle large numbers', () => {
      expect(formatFileSize(1125899906842624)).toBe('1024 TB');
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME types for known extensions', () => {
      expect(getMimeTypeFromExtension('test.txt')).toBe('text/plain');
      expect(getMimeTypeFromExtension('document.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('image.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('image.jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('video.mp4')).toBe('video/mp4');
      expect(getMimeTypeFromExtension('audio.mp3')).toBe('audio/mpeg');
      expect(getMimeTypeFromExtension('archive.zip')).toBe('application/zip');
    });

    it('should return default MIME type for unknown extensions', () => {
      expect(getMimeTypeFromExtension('file.unknown')).toBe('application/octet-stream');
      expect(getMimeTypeFromExtension('file.xyz')).toBe('application/octet-stream');
    });

    it('should handle files without extensions', () => {
      expect(getMimeTypeFromExtension('filename')).toBe('application/octet-stream');
    });

    it('should handle empty strings', () => {
      expect(getMimeTypeFromExtension('')).toBe('application/octet-stream');
    });

    it('should handle case insensitive extensions', () => {
      expect(getMimeTypeFromExtension('test.PDF')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('test.JPG')).toBe('image/jpeg');
    });
  });
});