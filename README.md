[![CircleCI](https://circleci.com/gh/griffinpp/objection-soft-delete/tree/master.svg?style=shield)](https://circleci.com/gh/griffinpp/objection-soft-delete/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/griffinpp/objection-soft-delete/badge.svg?branch=master)](https://coveralls.io/github/griffinpp/objection-soft-delete?branch=master)

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

// Import the plugin and specify the column to use.
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

### When `.delete()` or `.del()` is called for that model, the matching row(s) are flagged `true` instead of deleted
#### Delete a User:
```js
await User.query().where('id', 1).delete(); // db now has: { User id: 1, deleted: true, ... }
```

#### Or:
```js
const user = await User.query().where('id', 1).first();
await user.$query().delete(); // same
```

#### Deleted rows are still in the db:
```js
const deletedUser = await User.query().where('id', 1).first(); // => { User id: 1, deleted: true, ... }
```

#### Filter out deleted rows without having to remember each model's "deleted" columnName:
```js
const activeUsers = await User.query().whereNotDeleted();
```

#### Get only deleted rows:
```js
const deletedUsers = await User.query().whereDeleted();
```

#### Restore row(s):
```js
await User.query().where('id', 1).undelete();
```

#### Permanently remove row(s) from the db:
```js
await User.query.where('id', 1).hardDelete(); // => row with id:1 is permanently deleted
```

### Filtering out deleted/undeleted records in eagerly loaded models

#### Using the named filter
A `notDeleted` and a `deleted` filter will be added to the list of named filters for any model that mixes in the plugin.  These filters use the `.whereNotDeleted()` and `.whereDeleted()` functions to filter records, and can be used without needing to remember the specific columnName for any model:
```js
// some other Model with a relation to the `User` model:
const group = await UserGroup.query()
  .where('id', 1)
  .first()
  .eager('users(notDeleted)'); // => now group.users contains only records that are not deleted
```

Or:
```js
// some other Model with a relation to the `User` model:
const group = await UserGroup.query()
  .where('id', 1)
  .first()
  .eager('users(deleted)'); // => now group.users contains only records that are deleted
```

#### Using a relationship filter
As another option, a filter can be applied directly to the relationship definition to ensure that deleted/undeleted rows never appear:
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
          f.whereNotDeleted(); // or f.whereDeleted(), as needed
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

**columnName:** the name of the column to use as the soft delete flag on the model (Default: `'deleted'`).  The column must exist on the table for the model.

You can specify different column names per-model by using the options:
```js
const softDelete = require('objection-soft-delete')({
  columnName: 'inactive',
});
```

## Tests

Tests can be run with:
```sh
npm test
```

or:

```sh
yarn test
```


## Contributing

The usual spiel: fork, fix/improve, write tests, submit PR.  I try to maintain a (mostly) consistent syntax, but am open to suggestions for improvement. Otherwise, the only two rules are: do good work, and no tests = no merge.
