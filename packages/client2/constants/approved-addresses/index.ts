import NonUSEntitiesJson from "./nonus-entities.json";
import USEntitiesJson from "./us-accredited-entities.json";
import USIndividualsJson from "./us-accredited-individuals.json";

export const APPROVED_ADDRESSES = {
  NonUSEntities: NonUSEntitiesJson.map((address) => address.toLowerCase()),
  USEntities: USEntitiesJson.map((address) => address.toLowerCase()),
  USIndividuals: USIndividualsJson.map((address) => address.toLowerCase()),
};
