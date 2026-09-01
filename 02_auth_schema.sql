-- DDL for accounts, roles, and property scoping

CREATE TABLE IF NOT EXISTS public.account (
    account_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('guest', 'staff', 'manager', 'owner')),
    property_id INTEGER REFERENCES public.property(property_id) ON DELETE SET NULL,
    guest_id INTEGER REFERENCES public.guest(guest_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Enforce: Manager and Staff belong to exactly one property, Owner and Guest to none
    CONSTRAINT check_property_role_scope CHECK (
        (role IN ('staff', 'manager') AND property_id IS NOT NULL) OR
        (role IN ('guest', 'owner') AND property_id IS NULL)
    ),
    
    -- Enforce: Guest role must link to a guest record; Owner must not. Staff/Manager can optionally link (e.g. if hired).
    CONSTRAINT check_guest_role CHECK (
        (role = 'guest' AND guest_id IS NOT NULL) OR
        (role = 'owner' AND guest_id IS NULL) OR
        (role IN ('staff', 'manager'))
    )
);

-- Index for authentication email lookup (case-insensitive indexing is recommended)
CREATE INDEX IF NOT EXISTS idx_account_email ON public.account (email);

-- Index for fast foreign key resolution
CREATE INDEX IF NOT EXISTS idx_account_property ON public.account (property_id);
CREATE INDEX IF NOT EXISTS idx_account_guest ON public.account (guest_id);
