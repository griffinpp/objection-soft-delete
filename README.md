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

// Import the plugin
const softDelete = require('objection-soft-delete');

// Mixin the plugin and specify the column to to use.  'deleted' will be used if none is specified:
class User extends softDelete({ columnName: 'deleted' })(Model) {
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

#### Note: Make sure the `deleted` field of your table has a default value of `false` (and, while note required, you'll probably want to make it not nullable as well). A `deleted` value of `NULL` will result in this plugin producing unexpected behavior.

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
await User.query().where('id', 1).undelete(); // db now has: { User id: 1, deleted: false, ... }
```

#### Permanently remove row(s) from the db:
```js
await User.query.where('id', 1).hardDelete(); // => row with id:1 is permanently deleted
```

### Filtering out deleted/undeleted records in `.eager()` or `.joinRelation()`

#### Using the named filters
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

With `.joinRelation()`:
```js
// some other Model with a relation to the `User` model:
const group = await UserGroup.query()
  .where('id', 1)
  .joinRelation('users(notDeleted)')
  .where('users.firstName', 'like', 'a%'); // => all groups that have an undeleted user whose first name starts with 'a';
```

#### Using a relationship filter
A filter can be applied directly to the relationship definition to ensure that deleted/undeleted rows never appear:
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
          f.whereNotDeleted(); // or f.whereDeleted(), as needed.
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
  .eager('users'); // => `User` rows are filtered out automatically without having to specify the filter here
```

### Per-model `columnName`
If for some reason you have to deal with different column names for different models (legacy code/schemas can be a bear!), all functionality is fully supported:
```js
class User extends softDelete({ columnName: 'deleted' })(Model) {
  ...
}

class UserGroup extends softDelete({ columnName: 'inactive' })(Model) {
  ...
}

// everything will work as expected:
await User.query()
  .whereNotDeleted(); // => all undeleted users

await UserGroup.query()
  .whereNotDeleted(); // => all undeleted user groups

await UserGroup.query()
  .whereNotDeleted()
  .eager('users(notDeleted)'); // => all undeleted user groups, with all related undeleted users eagerly loaded

await User.query()
  .whereDeleted()
  .eager('groups(deleted)'); // => all deleted users, with all related deleted user groups eagerly loaded

await User.query()
  .whereNotDeleted()
  .joinRelation('groups(notDeleted)')
  .where('groups.name', 'like', '%local%')
  .eager('groups(notDeleted)'); // => all undeleted users that belong to undeleted user groups that have a name containing the string 'local', eagerly load all undeleted groups for said users.

// and so on...
```

### Using with `.upsertGraph()`
This plugin was actually born out of a need to have `.upsertGraph()` soft delete in some tables, and hard delete in others, so it plays nice with
`.upsertGraph()`:
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

### Lifecycle Functions

One issue that comes with doing soft deletes is that your calls to `.delete()` will actually trigger lifecycle functions for `.update()`, which may not be expected or desired.  To help address this, some context flags have been added to the `queryContext` that is passed into lifecycle functions to help discern whether the event that triggered (e.g.) `$beforeUpdate` was a true update, a soft delete, or an undelete:
```js
  $beforeUpdate(opt, queryContext) {
    if (queryContext.softDelete) {
      // do something before a soft delete, possibly including calling your $beforeDelete function.
      // Think this through carefully if you are using additional plugins, as their lifecycle
      // functions may execute before this one depending on how you have set up your inheritance chain!
    } else if (queryContext.undelete) {
      // do something before an undelete
    } else {
      // do something before a normal update
    }
  }
  
  // same procedure for $afterUpdate
```
Available flags are:
* softDelete
* undelete

Flags will be `true` if set, and `undefined` otherwise.

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

## Linting

The linter can be run with:
```sh
npm run lint
```

or:
```sh
yarn lint
```


## Contributing

The usual spiel: fork, fix/improve, write tests, submit PR.  I try to maintain a (mostly) consistent syntax, but am open to suggestions for improvement. Otherwise, the only two rules are: do good work, and no tests = no merge.
