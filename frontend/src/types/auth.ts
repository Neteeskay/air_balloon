export type LoginPayload = {
  login: string;
  password: string;
};

export type AuthResult = {
  ok: boolean;
  message: string;
};
