-- =====================================================
-- Six Sense Navigation
-- Navigation graph database tables
-- =====================================================

-- =====================================================
-- 1. Navigation Nodes
-- =====================================================

CREATE TABLE navigation_nodes (
    id BIGINT PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    street_count INTEGER
);


-- =====================================================
-- 2. Navigation Edges
-- =====================================================

CREATE TABLE navigation_edges (
    id BIGSERIAL PRIMARY KEY,

    from_node BIGINT NOT NULL,
    to_node BIGINT NOT NULL,

    osmid BIGINT,

    highway TEXT,
    lanes TEXT,
    maxspeed TEXT,
    name TEXT,
    oneway BOOLEAN,
    ref TEXT,
    reversed BOOLEAN,

    length DOUBLE PRECISION NOT NULL,

    -- Accessibility-aware routing cost.
    -- We will populate this later.
    weight DOUBLE PRECISION,

    -- Geometry is optional because only 2,486 / 5,452
    -- edges currently contain geometry.
    geometry TEXT,

    -- Make sure both nodes actually exist.
    CONSTRAINT fk_from_node
        FOREIGN KEY (from_node)
        REFERENCES navigation_nodes(id),

    CONSTRAINT fk_to_node
        FOREIGN KEY (to_node)
        REFERENCES navigation_nodes(id)
);


-- =====================================================
-- 3. Helpful indexes
-- =====================================================

CREATE INDEX idx_navigation_edges_from_node
    ON navigation_edges(from_node);

CREATE INDEX idx_navigation_edges_to_node
    ON navigation_edges(to_node);

CREATE INDEX idx_navigation_edges_highway
    ON navigation_edges(highway);