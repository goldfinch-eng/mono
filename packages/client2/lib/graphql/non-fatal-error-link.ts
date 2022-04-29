import { ApolloLink } from "@apollo/client";
import { Kind, ArgumentNode, DefinitionNode } from "graphql";

const nonFatalErrorArgNode: ArgumentNode = {
  kind: Kind.ARGUMENT,
  name: {
    kind: Kind.NAME,
    value: "subgraphError",
  },
  value: {
    kind: Kind.ENUM,
    value: "allow",
  },
};

/**
 * This link exists to get around some really annoying default behaviour in The Graph:
 * if the subgraph stops syncing due to an indexing error, it will only allow queries
 * to get through if they provide this argument: `subgraphError: allow`.
 * See documentation: https://thegraph.com/docs/en/developer/create-subgraph-hosted/#non-fatal-errors
 *
 * We don't want the app to have an outage if the subgraph stops syncing, so this link cause all queries
 * to opt in to non-fatal errors by default.
 */
export const nonFatalErrorLink = new ApolloLink((operation, forward) => {
  const queryCopy = { ...operation.query };
  queryCopy.definitions = queryCopy.definitions.map((definitionNode) => {
    if (definitionNode.kind !== Kind.OPERATION_DEFINITION) {
      return definitionNode;
    }
    const newDefinitionNode: DefinitionNode = {
      ...definitionNode,
      selectionSet: {
        ...definitionNode.selectionSet,
        selections: definitionNode.selectionSet.selections.map((selection) => {
          if (selection.kind !== Kind.FIELD) {
            return selection;
          }
          // The _meta field doesn't accept the error arg
          if (selection.name.value === "_meta") {
            return selection;
          }
          const isErrorArgAlreadySupplied = !selection.arguments
            ? false
            : selection.arguments.some(
                (arg) => arg.name.value === "subgraphError"
              );
          if (isErrorArgAlreadySupplied) {
            return selection;
          }
          const newArguments = !selection.arguments
            ? [nonFatalErrorArgNode]
            : [...selection.arguments, nonFatalErrorArgNode];
          const newSelection = { ...selection, arguments: newArguments };
          return newSelection;
        }),
      },
    };
    return newDefinitionNode;
  });
  operation.query = queryCopy;
  return forward(operation);
});
