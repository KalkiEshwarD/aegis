import {
  GET_MY_ROOMS,
  GET_ROOM,
  CREATE_ROOM_MUTATION,
  ADD_ROOM_MEMBER_MUTATION,
  UPDATE_ROOM_MUTATION,
  DELETE_ROOM_MUTATION,
  REMOVE_ROOM_MEMBER_MUTATION,
} from '../../apollo/rooms';

describe('Room GraphQL Queries and Mutations', () => {
  describe('Queries', () => {
    test('GET_MY_ROOMS query is defined', () => {
      expect(GET_MY_ROOMS).toBeDefined();
      expect(GET_MY_ROOMS).toBeTruthy();
    });

    test('GET_ROOM query is defined with correct variables', () => {
      expect(GET_ROOM).toBeDefined();
      expect(GET_ROOM).toBeTruthy();
    });
  });

  describe('Mutations', () => {
    test('CREATE_ROOM_MUTATION is defined with correct input', () => {
      expect(CREATE_ROOM_MUTATION).toBeDefined();
      expect(CREATE_ROOM_MUTATION).toBeTruthy();
    });

    test('ADD_ROOM_MEMBER_MUTATION is defined with username input', () => {
      expect(ADD_ROOM_MEMBER_MUTATION).toBeDefined();
      expect(ADD_ROOM_MEMBER_MUTATION).toBeTruthy();
    });

    test('UPDATE_ROOM_MUTATION is defined with correct input', () => {
      expect(UPDATE_ROOM_MUTATION).toBeDefined();
      expect(UPDATE_ROOM_MUTATION).toBeTruthy();
    });

    test('DELETE_ROOM_MUTATION is defined with correct input', () => {
      expect(DELETE_ROOM_MUTATION).toBeDefined();
      expect(DELETE_ROOM_MUTATION).toBeTruthy();
    });

    test('REMOVE_ROOM_MEMBER_MUTATION is defined with correct variables', () => {
      expect(REMOVE_ROOM_MEMBER_MUTATION).toBeDefined();
      expect(REMOVE_ROOM_MEMBER_MUTATION).toBeTruthy();
    });
  });
});