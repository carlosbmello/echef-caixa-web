// src/services/userService.ts
import api from './api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

// Não precisamos de uma interface 'UserResponse', podemos usar 'User' diretamente
// se a API retornar o objeto do usuário diretamente.

export const userService = {
  getUser: async (id: number): Promise<User> => {
    // A chamada à API retorna um objeto. Extraímos a propriedade 'data' dele.
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await api.get<User>('/users/me');
    return data;
  },
};