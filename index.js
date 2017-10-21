'use strict'

module.exports = (options) => {
  options = Object.assign({
    columnName: 'deleted'
  }, options);

  return (Model) => {
    class SDQueryBuilder extends Model.QueryBuilder {
      delete() {
        // override the normal delete function with one that patches the row's "deleted" column
        const patch = {};
        patch[options.columnName] = true;
        return this.patch(patch);
      }

      // provide a way to actually delete the row if necessary
      hardDelete() {
        return super.delete();
      }
    }
    return class extends Model {

      static get QueryBuilder() {
        return SDQueryBuilder;;
      }

      static get namedFilters() {
        // patch the notDeleted filter into the list of namedFilters
        return Object.assign({}, super.namedFilters, {
          notDeleted: (b) => {
            b.where(`${options.columnName}`, false);
          },
        });
      }
    };
  }
}
