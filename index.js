'use strict'

module.exports = (options) => {
  options = Object.assign({
    columnName: 'deleted'
  }, options);

  return (Model) => {
    class SDQueryBuilder extends Model.QueryBuilder {
      // override the normal delete function with one that patches the row's "deleted" column
      delete() {
        const patch = {};
        patch[options.columnName] = true;
        return this.patch(patch);
      }

      // provide a way to actually delete the row if necessary
      hardDelete() {
        return super.delete();
      }

      // provide a way to undo the delete
      undelete() {
        const patch = {}
        patch[options.columnName] = false;
        return this.patch(patch);
      }

      // provide a way to filter out deleted records without having to remember the column name every time
      whereNotDeleted() {
        // use the tableName to avoid conflicts
        return this.where(`${this._modelClass.tableName}.${options.columnName}`, false);
      }
    }
    return class extends Model {

      static get QueryBuilder() {
        return SDQueryBuilder;;
      }

      // add a named filter for use in the .eager() function
      static get namedFilters() {
        // patch the notDeleted filter into the list of namedFilters
        return Object.assign({}, super.namedFilters, {
          notDeleted: (b) => {
            b.whereNotDeleted();
          },
        });
      }
    };
  }
}
