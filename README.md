[![CircleCI](https://circleci.com/gh/griffinpp/objection-soft-delete/tree/master.svg?style=shield)](https://circleci.com/gh/griffinpp/objection-soft-delete/tree/master)

# objection-soft-delete
A plugin that adds soft-delete functionality to [Objection.js](https://github.com/Vincit/objection.js/)

## Installation

### NPM

```sh
npm i objection-soft-delete --save
```

### Yarn

```sh
yarn add objection-soft-delete
```

## Usage

### Mixin the plugin on an object representing a table that uses a boolean column as a flag for soft delete

```js
// Import objection model.
const Model = require('objection').Model;

// Import the plugin.
const softDelete = require('objection-soft-delete')({
  // 'deleted' will be used by default if no options are passed, but is shown here for clarity
  columnName: 'deleted',
});

// Mixin the plugin.
class User extends softDelete(Model) {
  static get tableName() {
    return 'Users';
  }
  
  static get jsonSchema() {
    return {
      type: 'object',
      required: [],

      properties: {
        id: { type: 'integer' },
        // matches the columnName passed above
        deleted: { type: 'boolean' },
        // other columns
      },
    }
  }
}
```

### Now when `.delete()` or `.del()` is called, the matching row(s) will be flagged instead of deleted
```js
// delete a User:
await User.query().where('id', 1).delete();

// can still fetch the row if necessary:
const deletedUser = await User.query().where('id', 1).first(); // => User { id: 1, deleted: true, ... }
```

### A named filter is provided for use in the `.eager()` function to filter out soft-deleted records
```js
// some other Model with a relation to the `User` model:
const group = await UserGroup.query()
  .where('id', 1)
  .first()
  .eager('users(notDeleted)'); // => now group.users contains only records that are not flagged as being deleted, based on whatever `columnName` you specified in the `User` model
```

### As another option, a filter can be applied directly to the relationship definition to ensure that deleted rows never appear:
```js
// some other class that has a FK to User:
class UserGroup extends Model {
  static get tableName() {
    return 'UserGroups';
  }
  
  ...
  
  static get relationMappings() {
    return {
      users: {
        relation: Model.ManyToManyRelation,
        modelClass: User,
        join: {
          from: 'UserGroups.id',
          through: {
            from: 'GroupUsers.groupId',
            to: 'GroupUsers.userId',
          },
          to: 'Users.id',
        },
        filter: (f) => {
          f.where('deleted', false); // be sure to use whatever columnName you have specified in the `User` model
        },
      },
    }
  }
}
```

then:
```js
const group = await UserGroup.query()
  .where('id', 1)
  .first()
  .eager('users'); // => deleted `User` rows are filtered out automatically without having to specify the filter here
```

### Actually deleting a row
Sometimes you still need to remove a row from the database. A `.hardDelete()` function has been provided for this purpose:
```js
await User.query()
  .where('id', 1)
  .hardDelete();
  
const user = await User.query()
  .where('id', 1)
  .first(); // => undefined
```

### Using with `.graphUpsert()`
This plugin was actually born out of a need to have `.graphUpsert()` soft delete in some tables, and hard delete in others, so it plays nice with
`.graphUpsert()`:
```js
// a model with soft delete
class Phone extends softDelete(Model) {
  static get tableName() {
    return 'Phones';
  }
}

// a model without soft delete
class Email extends Model {
  static get tableName() {
    return 'Emails';
  }
}

// assume a User model that relates to both, and the following existing data:
User {
  id: 1,
  name: 'Johnny Cash',
  phones: [
    {
      id: 6,
      number: '+19195551234',
    },
  ],
  emails: [
    {
      id: 3,
      address: 'mib@americanrecords.com',
    },
  ]
}

// then:

await User.query().upsertGraph({
  id: 1,
  name: 'Johnny Cash',
  phones: [],
  emails: [],
}); // => phone id 6 will be flagged deleted (and will still be related to Johnny!), email id 3 will be removed from the database
```

## Options

**columnName:** the name of the column to use as the soft delete flag on the model (Default: 'deleted').  The column must exist on the table for the model.

You can specify different column names per-model by using the options:
```js
const softDelete = require('objection-soft-delete')({
  columnName: inactive,
});
```

## Tests

Tests can be run with:
```sh
npm test
```
