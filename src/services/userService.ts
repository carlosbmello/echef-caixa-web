import api from './api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface UserResponse {
  data: User;
}

export const userService = {
  getUser: async (id: number): Promise<UserResponse> => {
    const response = await api.get(`/users/${id}`);
    return response;
  },

  getCurrentUser: async (): Promise<UserResponse> => {
    const response = await api.get('/users/me');
    return response;
  },

  // Add other user-related methods as needed
};