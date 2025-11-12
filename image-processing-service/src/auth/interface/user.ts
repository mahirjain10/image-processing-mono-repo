export interface CreateUser {
  name: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  login_limit:number;
  upload_limit:number;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}
