import type {
  Coordinate,
  NavigationGraph,
  NodeId,
} from "./types";

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees:number):number{
    return degrees * Math.PI / 180
}

function assertValidCoordinate(
    coordinate:Coordinate,
    label:string,
):void{
    const {latitude,longitude} = coordinate;
    if(!Number.isFinite(latitude)|| !Number.isFinite(longitude)){
        throw new TypeError(
            `${label} coordinate must contain finite numbers`,
        )};
    if(latitude<-90 || latitude > 90){
        throw new RangeError(
            `${label} latitude must be between -90 and 90.`,
        );
    }
    if(longitude<-180 || longitude>180){
        throw new RangeError(
            `${label} longitude must between -180 and 180.`,
        );
    }
}

export function haversineDistanceMeters(
  from: Coordinate,
  to: Coordinate,
): number {
  assertValidCoordinate(from, "From");
  assertValidCoordinate(to, "To");

  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const latitudeDifference = toRadians(
    to.latitude - from.latitude,
  );

  const longitudeDifference = toRadians(
    to.longitude - from.longitude,
  );

  const haversineValue =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const safeHaversineValue = Math.min(
    1,
    Math.max(0, haversineValue),
  );

  const centralAngle =
    2 *
    Math.atan2(
      Math.sqrt(safeHaversineValue),
      Math.sqrt(1 - safeHaversineValue),
    );

  return EARTH_RADIUS_METERS * centralAngle;
}

export function calculateRouteDistance(
  graph: NavigationGraph,
  nodeIds: readonly NodeId[],
): number {
  if (nodeIds.length < 2) {
    return 0;
  }

  let totalDistanceMeters = 0;

  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const fromId = nodeIds[index];
    const toId = nodeIds[index + 1];

    if (!(fromId in graph)) {
      throw new Error(`Unknown route node: "${fromId}".`);
    }

    if (!(toId in graph)) {
      throw new Error(`Unknown route node: "${toId}".`);
    }

    const edge = graph[fromId].find(
      (candidate) => candidate.to === toId,
    );

    if (!edge) {
      throw new Error(
        `No graph edge exists from "${fromId}" to "${toId}".`,
      );
    }

    if (
      !Number.isFinite(edge.distanceMeters) ||
      edge.distanceMeters < 0
    ) {
      throw new RangeError(
        `Edge from "${fromId}" to "${toId}" has an invalid distance.`,
      );
    }

    totalDistanceMeters += edge.distanceMeters;
  }

  return totalDistanceMeters;
}