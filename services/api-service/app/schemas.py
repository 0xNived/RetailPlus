from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResult(BaseModel):
    access_token: str
    token_type: str
    user: dict[str, str]


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
