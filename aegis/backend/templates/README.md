# Templates

This directory contains HTML templates that are used by the Aegis backend.

## File

*   `share_access.html`: This is a Go template that renders the page for accessing a password-protected shared file. It includes a form for entering the password and displays metadata about the file, such as its name, size, and expiration date.

## Functionality

Templates in this directory are used to generate dynamic HTML content that is served to the user. The backend populates these templates with data from the database and then renders them as HTML.

This allows for the creation of user-facing pages, such as the file sharing page, without having to build a full-fledged frontend for these specific features.
