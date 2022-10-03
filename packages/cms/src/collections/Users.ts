import { CollectionConfig } from "payload/types";

const Users: CollectionConfig = {
  slug: "cms-users",
  labels: {
    singular: "CMS User",
    plural: "CMS Users",
  },
  auth: true,
  admin: {
    useAsTitle: "email",
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) {
        return true;
      }
    },
  },
  fields: [],
};

export default Users;
