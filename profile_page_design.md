# Profile Page Implementation Design

## Overview
Design and implement a profile page for Aegis that allows users to edit their username, email, and password. The page should be served on a separate `/profile` endpoint and look similar to the dashboard layout, but replace the file explorer area with profile settings.

## Requirements
- Separate `/profile` endpoint
- Dashboard-like layout (DashboardAppBar + DashboardSidebar + main content)
- Profile settings form with username, email, password fields
- Navigation from user menu
- Sidebar tabs not active when on profile page
- Backend GraphQL mutation for updating user profile
- Frontend form validation and error handling

## Backend Changes

### GraphQL Schema Updates
Add to `schema.graphql`:

```graphql
input UpdateProfileInput {
  username: String
  email: String
  currentPassword: String
  newPassword: String
}

type Mutation {
  # ... existing mutations
  updateProfile(input: UpdateProfileInput!): User!
}
```

### UserService Updates
Add `UpdateProfile` method to `UserService`:

```go
func (s *UserService) UpdateProfile(userID uint, username, email, currentPassword, newPassword string) (*models.User, error) {
    // Get current user
    // Validate current password if changing password
    // Check uniqueness of username/email if changing
    // Hash new password if provided
    // Update user in database
    // Return updated user
}
```

### Resolver Updates
Add `UpdateProfile` resolver in `schema.resolvers.go`.

## Frontend Changes

### Routing
Add `/profile` route to `App.tsx`.

### Components
- Create `Profile.tsx` component with dashboard-like layout
- Create profile settings form component
- Update `DashboardAppBar.tsx` to add Profile menu item
- Update `useUserMenu.ts` hook to handle profile navigation

### GraphQL
Add GraphQL mutation for profile updates.

### Navigation
Ensure sidebar tabs are not highlighted when on profile page.

## Implementation Steps
1. Backend: Add UpdateProfileInput and updateProfile mutation to GraphQL schema
2. Backend: Implement UpdateProfile method in UserService
3. Backend: Add UpdateProfile resolver
4. Frontend: Add /profile route to App.tsx
5. Frontend: Create Profile component with dashboard layout
6. Frontend: Add Profile menu item to DashboardAppBar
7. Frontend: Update useUserMenu hook
8. Frontend: Create profile settings form
9. Frontend: Add GraphQL mutation for profile updates
10. Frontend: Implement form validation and error handling
11. Test the complete functionality

## Security Considerations
- Password changes require current password verification
- Username and email uniqueness validation
- Proper authentication checks in resolvers
- Input validation and sanitization

## UI/UX Considerations
- Form should show current values
- Clear error messages for validation failures
- Loading states during updates
- Success feedback after successful updates
- Consistent styling with dashboard theme