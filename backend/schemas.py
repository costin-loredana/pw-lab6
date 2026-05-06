from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Any, List, Optional
from pydantic import BaseModel, Field, field_validator


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


class CamelModel(BaseModel):
    """Base model that serializes to camelCase for the React frontend."""
    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
        "from_attributes": True,
    }


# ── Auth ──────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    role: Optional[str] = Field(None, description="ADMIN | WRITER | VISITOR")
    permissions: Optional[List[str]] = Field(None, description="['READ','WRITE','DELETE']")
    model_config = {"json_schema_extra": {"example": {"role": "ADMIN"}}}


class TokenResponse(CamelModel):
    token: str
    expires_in: int        # → expiresIn
    role: Optional[str] = None
    permissions: List[str]


# ── Category ──────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    color: str = Field("#9e9e9e", pattern=r"^#[0-9a-fA-F]{6}$")


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class CategoryOut(CamelModel):
    id: str
    name: str
    color: str
    expense_count: int = 0   # → expenseCount


# ── Expense ───────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    date: date
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    category: str
    description: str = Field("", max_length=500)
    model_config = {"populate_by_name": True}

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    category: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)


class ExpenseOut(CamelModel):
    id: str
    date: date
    amount: Decimal
    category: str
    description: str
    created_at: datetime   # → createdAt
    updated_at: datetime   # → updatedAt


# ── Salary ────────────────────────────────────────────────────────

class SalaryUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, ge=0)


class SalaryOut(BaseModel):
    amount: Optional[Decimal]


# ── Pagination ────────────────────────────────────────────────────

class PaginationMeta(CamelModel):
    page: int
    limit: int
    total: int
    total_pages: int       # → totalPages


class PaginatedResponse(BaseModel):
    data: List[Any]
    pagination: PaginationMeta


# ── Stats ─────────────────────────────────────────────────────────

class MonthStats(CamelModel):
    month: str
    total: Decimal
    count: int


class StatsOut(CamelModel):
    total_expenses: int          # → totalExpenses
    total_amount: Decimal        # → totalAmount
    current_month: MonthStats    # → currentMonth
    by_category: dict[str, Decimal]   # → byCategory
    by_month: dict[str, Decimal]      # → byMonth
    salary: Optional[Decimal]
    remaining: Optional[Decimal]