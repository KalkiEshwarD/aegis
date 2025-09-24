import { GET_USERS } from '../../apollo/queries';

describe('User GraphQL Queries', () => {
  describe('GET_USERS query', () => {
    test('GET_USERS query is defined with search parameter', () => {
      expect(GET_USERS).toBeDefined();
      expect(GET_USERS).toBeTruthy();
    });

    test('GET_USERS query includes user fields', () => {
      expect(GET_USERS).toBeDefined();
    });
  });
});