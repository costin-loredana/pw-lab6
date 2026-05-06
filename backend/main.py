import math
import secrets
import time
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse as _JSONResponse
from pydantic import BaseModel as _BaseModel

class AliasJSONResponse(_JSONResponse):
    """Serialize Pydantic models using their aliases (camelCase)."""
    def render(self, content) -> bytes:
        import json
        if isinstance(content, _BaseModel):
            return content.model_dump_json(by_alias=True).encode()
        return json.dumps(content, default=str).encode()

from auth import (
    ROLE_PERMISSIONS, JWT_EXPIRE_SECONDS,
    create_token, require_permission,
    READ, WRITE, DELETE,
)
from database import get_db, get_cursor
from schemas import (
    CategoryCreate, CategoryOut, CategoryUpdate,
    ExpenseCreate, ExpenseOut, ExpenseUpdate,
    PaginatedResponse, PaginationMeta,
    SalaryOut, SalaryUpdate,
    StatsOut, MonthStats,
    TokenRequest, TokenResponse,
)

# ── App ───────────────────────────────────────────────────────────

app = FastAPI(
    default_response_class=AliasJSONResponse,
    title="Finance Tracker API",
    version="5.0.0",
    description=(
        "REST API for the personal finance tracker.\n\n"
        "**Auth:** call `POST /token` to get a JWT, then use it as "
        "`Authorization: Bearer <token>` on all other endpoints.\n\n"
        "Token expires in **30 minutes** (1800 seconds). Roles: `ADMIN`, `WRITER`, `VISITOR`."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Normalize errors to { "error": "..." } for the React frontend ─

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0]["msg"] if errors else "Validation error"
    return JSONResponse(
        status_code=422,
        content={"error": msg},
    )

# ── Helpers ───────────────────────────────────────────────────────

def new_id() -> str:
    return secrets.token_hex(8)


def paginate_query(
    query: str,
    params: tuple,
    count_query: str,
    count_params: tuple,
    page: int,
    limit: int,
    conn,
) -> PaginatedResponse:
    """Run a paginated SELECT and return PaginatedResponse."""
    page  = max(1, page)
    limit = min(100, max(1, limit))
    offset = (page - 1) * limit

    with get_cursor(conn) as cur:
        cur.execute(count_query, count_params)
        total = cur.fetchone()["count"]

        cur.execute(query + f" LIMIT %s OFFSET %s", params + (limit, offset))
        rows = cur.fetchall()

    total_pages = max(1, math.ceil(total / limit))
    return PaginatedResponse(
        data=list(rows),
        pagination=PaginationMeta(
            page=page, limit=limit,
            total=total, total_pages=total_pages,
        ),
    )


# ── Root ─────────────────────────────────────────────────────────

@app.get("/", tags=["Info"])
def root():
    return {"message": "Finance Tracker API", "version": "5.0.0", "docs": "/docs"}


# ══════════════════════════════════════════════════════════════════
#  AUTH
# ══════════════════════════════════════════════════════════════════

@app.post(
    "/token",
    response_model=TokenResponse,
    tags=["Auth"],
    summary="Get a JWT token",
    description=(
        "Pass `role` (ADMIN | WRITER | VISITOR) **or** a custom `permissions` list.\n\n"
        "Token expires in 30 minutes (1800 seconds)."
    ),
)
def get_token(body: TokenRequest):
    valid_roles = list(ROLE_PERMISSIONS.keys())
    valid_perms = {"READ", "WRITE", "DELETE"}

    if body.role:
        if body.role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Choose from: {valid_roles}",
            )
        perms = ROLE_PERMISSIONS[body.role]
        payload = {"role": body.role, "permissions": perms}
        token = create_token(payload)
        return TokenResponse(
            token=token,
            expires_in=JWT_EXPIRE_SECONDS,
            role=body.role,
            permissions=perms,
        )

    if body.permissions is not None:
        bad = set(body.permissions) - valid_perms
        if bad:
            raise HTTPException(status_code=400, detail=f"Invalid permissions: {bad}")
        payload = {"permissions": body.permissions}
        token = create_token(payload)
        return TokenResponse(
            token=token,
            expires_in=JWT_EXPIRE_SECONDS,
            permissions=body.permissions,
        )

    raise HTTPException(
        status_code=400,
        detail="Provide 'role' (ADMIN|WRITER|VISITOR) or 'permissions' list",
    )


# ══════════════════════════════════════════════════════════════════
#  EXPENSES
# ══════════════════════════════════════════════════════════════════

@app.get(
    "/expenses",
    response_model=PaginatedResponse,
    tags=["Expenses"],
    summary="List expenses — paginated, filterable, sortable",
)
def list_expenses(
    page:     int = Query(1,   ge=1),
    limit:    int = Query(20,  ge=1, le=100),
    category: Optional[str] = Query(None),
    month:    Optional[str] = Query(None, description="YYYY-MM"),
    sort:     str = Query("date_desc", enum=["date_desc", "date_asc", "amount_desc", "amount_asc"]),
    _user=READ,
):
    filters = []
    params: list = []

    if category and category != "all":
        filters.append("e.category_id = %s")
        params.append(category)
    if month and month != "all":
        filters.append("TO_CHAR(e.date, 'YYYY-MM') = %s")
        params.append(month)

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    order_map = {
        "date_desc":   "e.date DESC, e.created_at DESC",
        "date_asc":    "e.date ASC,  e.created_at ASC",
        "amount_desc": "e.amount DESC",
        "amount_asc":  "e.amount ASC",
    }
    order = order_map[sort]

    select = f"""
        SELECT
            e.id,
            e.date,
            e.amount,
            e.category_id AS category,
            e.description,
            e.created_at,
            e.updated_at
        FROM expenses e
        {where}
        ORDER BY {order}
    """
    count_q = f"SELECT COUNT(*) AS count FROM expenses e {where}"

    with get_db() as conn:
        result = paginate_query(
            select, tuple(params),
            count_q, tuple(params),
            page, limit, conn,
        )

    # Convert rows to ExpenseOut dicts
    result.data = [dict(r) for r in result.data]
    return result


@app.get(
    "/expenses/{expense_id}",
    response_model=ExpenseOut,
    tags=["Expenses"],
    summary="Get a single expense",
)
def get_expense(expense_id: str, _user=READ):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id, date, amount, category_id AS category,
                       description, created_at, updated_at
                FROM expenses WHERE id = %s
                """,
                (expense_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    return dict(row)


@app.post(
    "/expenses",
    response_model=ExpenseOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Expenses"],
    summary="Create expense",
)
def create_expense(body: ExpenseCreate, _user=WRITE):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            # Validate category exists
            cur.execute("SELECT id FROM categories WHERE id = %s", (body.category,))
            if not cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{body.category}' does not exist",
                )

            exp_id = new_id()
            cur.execute(
                """
                INSERT INTO expenses (id, date, amount, category_id, description)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, date, amount, category_id AS category,
                          description, created_at, updated_at
                """,
                (exp_id, body.date, body.amount, body.category, body.description),
            )
            return dict(cur.fetchone())


@app.put(
    "/expenses/{expense_id}",
    response_model=ExpenseOut,
    tags=["Expenses"],
    summary="Update expense",
)
def update_expense(expense_id: str, body: ExpenseUpdate, _user=WRITE):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT id FROM expenses WHERE id = %s", (expense_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Expense not found")

            if body.category is not None:
                cur.execute("SELECT id FROM categories WHERE id = %s", (body.category,))
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Category '{body.category}' does not exist",
                    )

            # Build dynamic SET clause
            fields = []
            vals: list = []
            if body.date        is not None: fields.append("date = %s");        vals.append(body.date)
            if body.amount      is not None: fields.append("amount = %s");      vals.append(body.amount)
            if body.category    is not None: fields.append("category_id = %s"); vals.append(body.category)
            if body.description is not None: fields.append("description = %s"); vals.append(body.description)

            if not fields:
                raise HTTPException(status_code=400, detail="No fields to update")

            fields.append("updated_at = NOW()")
            vals.append(expense_id)

            cur.execute(
                f"""
                UPDATE expenses SET {', '.join(fields)}
                WHERE id = %s
                RETURNING id, date, amount, category_id AS category,
                          description, created_at, updated_at
                """,
                vals,
            )
            return dict(cur.fetchone())


@app.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Expenses"],
    summary="Delete expense",
)
def delete_expense(expense_id: str, _user=DELETE):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "DELETE FROM expenses WHERE id = %s RETURNING id", (expense_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Expense not found")


# ══════════════════════════════════════════════════════════════════
#  CATEGORIES
# ══════════════════════════════════════════════════════════════════

@app.get(
    "/categories",
    response_model=PaginatedResponse,
    tags=["Categories"],
    summary="List categories with expense counts — paginated",
)
def list_categories(
    page:  int = Query(1,   ge=1),
    limit: int = Query(20,  ge=1, le=100),
    _user=READ,
):
    select = """
        SELECT c.id, c.name, c.color,
               COUNT(e.id) AS expense_count
        FROM categories c
        LEFT JOIN expenses e ON e.category_id = c.id
        GROUP BY c.id, c.name, c.color
        ORDER BY c.name
    """
    count_q = "SELECT COUNT(*) AS count FROM categories"

    with get_db() as conn:
        result = paginate_query(select, (), count_q, (), page, limit, conn)

    result.data = [dict(r) for r in result.data]
    return result


@app.get(
    "/categories/{cat_id}",
    response_model=CategoryOut,
    tags=["Categories"],
    summary="Get a single category",
)
def get_category(cat_id: str, _user=READ):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.color, COUNT(e.id) AS expense_count
                FROM categories c
                LEFT JOIN expenses e ON e.category_id = c.id
                WHERE c.id = %s
                GROUP BY c.id
                """,
                (cat_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    return dict(row)


@app.post(
    "/categories",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Categories"],
    summary="Create category",
)
def create_category(body: CategoryCreate, _user=WRITE):
    cat_id = body.name.lower().replace(" ", "_")
    # Keep only alphanumeric + underscore
    cat_id = "".join(c for c in cat_id if c.isalnum() or c == "_")

    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT id FROM categories WHERE id = %s", (cat_id,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail=f"Category '{cat_id}' already exists",
                )
            cur.execute(
                """
                INSERT INTO categories (id, name, color) VALUES (%s, %s, %s)
                RETURNING id, name, color, 0 AS expense_count
                """,
                (cat_id, body.name, body.color),
            )
            return dict(cur.fetchone())


@app.put(
    "/categories/{cat_id}",
    response_model=CategoryOut,
    tags=["Categories"],
    summary="Update category name/color",
)
def update_category(cat_id: str, body: CategoryUpdate, _user=WRITE):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT id FROM categories WHERE id = %s", (cat_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Category not found")

            fields = []
            vals: list = []
            if body.name  is not None: fields.append("name = %s");  vals.append(body.name)
            if body.color is not None: fields.append("color = %s"); vals.append(body.color)

            if not fields:
                raise HTTPException(status_code=400, detail="No fields to update")

            vals.append(cat_id)
            cur.execute(
                f"UPDATE categories SET {', '.join(fields)} WHERE id = %s RETURNING id, name, color",
                vals,
            )
            row = dict(cur.fetchone())

            cur.execute(
                "SELECT COUNT(*) AS expense_count FROM expenses WHERE category_id = %s",
                (cat_id,),
            )
            row["expense_count"] = cur.fetchone()["expense_count"]
            return row


@app.delete(
    "/categories/{cat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Categories"],
    summary="Delete category",
)
def delete_category(cat_id: str, _user=DELETE):
    if cat_id == "other":
        raise HTTPException(status_code=400, detail="Cannot delete the 'other' category")

    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT id FROM categories WHERE id = %s", (cat_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Category not found")

            cur.execute(
                "SELECT COUNT(*) AS cnt FROM expenses WHERE category_id = %s", (cat_id,)
            )
            if cur.fetchone()["cnt"] > 0:
                raise HTTPException(
                    status_code=409,
                    detail="Category has associated expenses — move them first",
                )

            cur.execute("DELETE FROM categories WHERE id = %s", (cat_id,))


# ══════════════════════════════════════════════════════════════════
#  SALARY
# ══════════════════════════════════════════════════════════════════

@app.get("/salary", response_model=SalaryOut, tags=["Salary"])
def get_salary(_user=READ):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT amount FROM salary_config WHERE id = 1")
            row = cur.fetchone()
    return {"amount": row["amount"] if row else None}


@app.put("/salary", response_model=SalaryOut, tags=["Salary"])
def update_salary(body: SalaryUpdate, _user=WRITE):
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "UPDATE salary_config SET amount = %s WHERE id = 1 RETURNING amount",
                (body.amount,),
            )
            row = cur.fetchone()
    return {"amount": row["amount"] if row else None}


# ══════════════════════════════════════════════════════════════════
#  STATS - FIXED VERSION (no NaN issues)
# ══════════════════════════════════════════════════════════════════

@app.get("/stats", response_model=StatsOut, tags=["Stats"])
def get_stats(_user=READ):
    cur_month = datetime.now(timezone.utc).strftime("%Y-%m")

    with get_db() as conn:
        with get_cursor(conn) as cur:
            # Totals - use COALESCE to avoid NULL
            cur.execute("""
                SELECT 
                    COALESCE(COUNT(*), 0) AS cnt, 
                    COALESCE(SUM(amount), 0)::float AS total 
                FROM expenses
            """)
            totals = cur.fetchone()
            
            # Current month
            cur.execute("""
                SELECT 
                    COALESCE(COUNT(*), 0) AS cnt, 
                    COALESCE(SUM(amount), 0)::float AS total
                FROM expenses
                WHERE TO_CHAR(date, 'YYYY-MM') = %s
            """, (cur_month,))
            cm = cur.fetchone()

            # By category - ONLY include categories with expenses > 0
            cur.execute("""
                SELECT 
                    category_id, 
                    COALESCE(SUM(amount), 0)::float AS total
                FROM expenses 
                GROUP BY category_id
            """)
            by_cat = {}
            for r in cur.fetchall():
                cat_id = r["category_id"]
                total = float(r["total"]) if r["total"] is not None else 0.0
                if total > 0:  # Only include categories with actual expenses
                    by_cat[cat_id] = total

            # By month
            cur.execute("""
                SELECT 
                    TO_CHAR(date, 'YYYY-MM') AS month,
                    COALESCE(SUM(amount), 0)::float AS total
                FROM expenses 
                GROUP BY 1 
                ORDER BY 1
            """)
            by_month = {}
            for r in cur.fetchall():
                month = r["month"]
                total = float(r["total"]) if r["total"] is not None else 0.0
                by_month[month] = total

            # Salary
            cur.execute("SELECT amount FROM salary_config WHERE id = 1")
            sal_row = cur.fetchone()
            salary = float(sal_row["amount"]) if sal_row and sal_row["amount"] is not None else None

    cm_total = float(cm["total"]) if cm["total"] is not None else 0.0
    remaining = (salary - cm_total) if salary is not None else None
    if remaining is not None:
        remaining = float(remaining)

    return StatsOut(
        total_expenses=int(totals["cnt"]) if totals["cnt"] is not None else 0,
        total_amount=float(totals["total"]) if totals["total"] is not None else 0.0,
        current_month=MonthStats(
            month=cur_month, 
            total=cm_total, 
            count=int(cm["cnt"]) if cm["cnt"] is not None else 0
        ),
        by_category=by_cat,
        by_month=by_month,
        salary=salary,
        remaining=remaining,
    )