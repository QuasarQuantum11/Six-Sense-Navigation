export type NodeId = string;

export interface Coordinate{
    latitude:number;
    longitude:number;
}
export interface GraphEdge{
    to:NodeId;
    distanceMeters:number;
    cost:number;
}
export type NavigationGraph = Readonly<
Record<NodeId,readonly GraphEdge[]>
>;
export interface RouteResult {
    nodeIds:NodeId[];
    totalCost:number;
    distanceMeters:number;
}
