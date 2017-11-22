'use strict' // eslint-disable-line

module.exports = (incomingOptions) => {
  const options = Object.assign({
    columnName: 'deleted',
  }, incomingOptions);

  return (Model) => {
    class SDQueryBuilder extends Model.QueryBuilder {
      // override the normal delete function with one that patches the row's "deleted" column
      delete() {
        this.mergeContext({ softDelete: true });
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
        this.mergeContext({ undelete: true });
        const patch = {};
        patch[options.columnName] = false;
        return this.patch(patch);
      }

      // provide a way to filter to ONLY deleted records without having to remember the column name
      whereDeleted() {
        // qualify the column name
        return this.where(`${this.modelClass().tableName}.${options.columnName}`, true);
      }

      // provide a way to filter out deleted records without having to remember the column name
      whereNotDeleted() {
        // qualify the column name
        return this.where(`${this.modelClass().tableName}.${options.columnName}`, false);
      }
    }
    return class extends Model {
      constructor() {
        super();

        const beforeUpdate = this.$beforeUpdate;
        const beforeDelete = this.$beforeDelete;
        const afterUpdate = this.$afterUpdate;
        const afterDelete = this.$afterDelete;

        this.$beforeUpdate = (opts, queryContext) => {
          if (queryContext.softDelete) {
            this.$beforeSoftDelete(queryContext);
            this.$beforeDelete(queryContext);
          } else if (queryContext.undelete) {
            this.$beforeUndelete(queryContext);
          } else {
            beforeUpdate(opts, queryContext);
          }
        };

        this.$beforeDelete = (queryContext) => {
          if (!queryContext.softDelete) {
            this.$beforeHardDelete(queryContext);
          }
          beforeDelete(queryContext);
        };

        this.$afterUpdate = (opts, queryContext) => {
          if (queryContext.softDelete) {
            this.$afterSoftDelete(queryContext);
            this.$afterDelete(queryContext);
          } else if (queryContext.undelete) {
            this.$afterUndelete(queryContext);
          } else {
            afterUpdate(opts, queryContext);
          }
        };

        this.$afterDelete = (queryContext) => {
          if (!queryContext.softDelete) {
            this.$afterHardDelete(queryContext);
          }
          afterDelete(queryContext);
        };
      }

      static get QueryBuilder() {
        return SDQueryBuilder;
      }

      // eslint-disable-next-line class-methods-use-this
      $beforeSoftDelete() {
        // expect this to be overridden in whatever class extends
      }

      // eslint-disable-next-line class-methods-use-this
      $afterSoftDelete() {
        // expect this to be overridden in whatever class extends
      }

      // eslint-disable-next-line class-methods-use-this
      $beforeHardDelete() {
        // expect this to be overridden in whatever class extends
      }

      // eslint-disable-next-line class-methods-use-this
      $afterHardDelete() {
        // expect this to be overridden in whatever class extends
      }

      // eslint-disable-next-line class-methods-use-this
      $beforeUndelete() {
        // expect this to be overridden in whatever class extends
      }

      // eslint-disable-next-line class-methods-use-this
      $afterUndelete() {
        // expect this to be overridden in whatever class extends
      }

      // add a named filter for use in the .eager() function
      static get namedFilters() {
        // patch the notDeleted filter into the list of namedFilters
        return Object.assign({}, super.namedFilters, {
          notDeleted: (b) => {
            b.whereNotDeleted();
          },
          deleted: (b) => {
            b.whereDeleted();
          },
        });
      }
    };
  };
};
