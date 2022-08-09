

import { getLogger } from './logger'

export const _buildEngine = (source, vtLayer) => {

  if (!source.filterSet)
    source.filterSet = { mode: "NONE", values: {}, layer: null };

  return {
    when: (field) => {

      if (source.filterSet.mode == "NONE")
        source.filterSet.mode = "OR"

      return {
        isAny: (values) => {
          source.filterSet.values[field] = { any: true, values: values };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isAll: (values) => {
          source.filterSet.values[field] = { all: true, values: values };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        contains: (value) => {
          source.filterSet.values[field] = { contains: true, values: value };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        containsAny: (values) => {
          source.filterSet.values[field] = { containsAny: true, values: values };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        containsAll: (values) => {
          source.filterSet.values[field] = { containsAll: true, values: values };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isExactly: (value) => {
          source.filterSet.values[field] = { exactly: true, values: value };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        inRangeInclusive: (min, max) => {
          source.filterSet.values[field] = { inRangeInclusive: true, values: [min, max] };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        inRangeExclusive: (min, max) => {
          source.filterSet.values[field] = { inRangeExclusive: true, values: [min, max] };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isGreaterThan: (value) => {
          source.filterSet.values[field] = { isGreaterThan: true, values: [value] };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isLessThan: (value) => {
          source.filterSet.values[field] = { isLessThan: true, values: [value] };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isGreaterThanOrEqualTo: (value) => {
          source.filterSet.values[field] = { isGreaterThanOrEqualTo: true, values: [value] };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isLessThanOrEqualTo: (value) => {
          source.filterSet.values[field] = { isLessThanOrEqualTo: true, values: [value] };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isNot: (value) => {
          source.filterSet.values[field] = { isNot: true, values: value };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isNotAny: (values) => {
          source.filterSet.values[field] = { isNotAny: true, values: values };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isNotAll: (values) => {
          source.filterSet.values[field] = { isNotAll: true, values: values };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isNull: () => {
          source.filterSet.values[field] = { isNull: true };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        isNotNull: () => {
          source.filterSet.values[field] = { isNotNull: true };
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        },
        clear: () => {
          delete source.filterSet.values[field];
          getLogger()(source.filterSet);
          source.changed();
          return _buildEngine(source, vtLayer);
        }
      }
    },
    clear: () => {
      source.filterSet.values = {};
      source.filterSet.mode = "NONE"
      source.changed();
      return _buildEngine(source, vtLayer);
    },
    andJoin: () => {
      source.filterSet.mode = "AND"
      getLogger()(source.filterSet);
      source.changed();
      return _buildEngine(source, vtLayer);
    },
    orJoin: () => {
      source.filterSet.mode = "OR"
      getLogger()(source.filterSet);
      source.changed();
      return _buildEngine(source, vtLayer);
    },
    invert: () => {
      source.filterSet.invert = true;
      getLogger()(source.filterSet);
      source.changed();
      return _buildEngine(source, vtLayer);
    },
    appliesTo: (layer) => {
      source.filterSet.layer = layer;
      getLogger()(source.filterSet);
      source.changed();
      return _buildEngine(source, vtLayer);
    }
  }
};

export const applyToGroup = (group) => {
  return {
    when: (field) => {

      return {
        isAny: (values) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isAny(values);
            }
          }

          return applyToGroup(group);
        },
        isAll: (values) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isAll(values);
            }
          }

          return applyToGroup(group);
        },
        contains: (value) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).contains(value);
            }
          }

          return applyToGroup(group);
        },
        containsAny: (values) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).containsAny(values);
            }
          }

          return applyToGroup(group);
        },
        containsAll: (values) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).containsAll(values);
            }
          }

          return applyToGroup(group);
        },
        isExactly: (value) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isExactly(value);
            }
          }

          return applyToGroup(group);
        },
        inRangeInclusive: (min, max) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).inRangeInclusive(min, max);
            }
          }

          return applyToGroup(group);
        },
        inRangeExclusive: (min, max) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).inRangeExclusive(min, max);
            }
          }

          return applyToGroup(group);
        },
        isGreaterThan: (value) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isGreaterThan(value);
            }
          }

          return applyToGroup(group);
        },
        isLessThan: (value) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isLessThan(value);
            }
          }

          return applyToGroup(group);
        },
        isGreaterThanOrEqualTo: (value) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isGreaterThanOrEqualTo(value);
            }
          }

          return applyToGroup(group);
        },
        isLessThanOrEqualTo: (value) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isLessThanOrEqualTo(value);
            }
          }

          return applyToGroup(group);
        },
        isNot: (value) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isNot(value);
            }
          }

          return applyToGroup(group);
        },
        isNotAny: (values) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isNotAny(values);
            }
          }

          return applyToGroup(group);
        },
        isNotAll: (values) => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isNotAll(values);
            }
          }

          return applyToGroup(group);
        },
        isNull: () => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isNull();
            }
          }

          return applyToGroup(group);
        },
        isNotNull: () => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).isNotNull();
            }
          }

          return applyToGroup(group);
        },
        clear: () => {
          for(let layer of group.getLayersArray()) {
            if(layer.filter) {
              layer.filter.when(field).clear();
            }
          }

          return applyToGroup(group);
        }
      }
    },
    clear: () => {
      for(let layer of group.getLayersArray()) {
        if(layer.filter) {
          layer.filter.clear();
        }
      }

      return applyToGroup(group);
    },
    andJoin: () => {
      for(let layer of group.getLayersArray()) {
        if(layer.filter) {
          layer.filter.andJoin();
        }
      }

      return applyToGroup(group);
    },
    orJoin: () => {
      for(let layer of group.getLayersArray()) {
        if(layer.filter) {
          layer.filter.orJoin();
        }
      }

      return applyToGroup(group);
    },
    invert: () => {
      for(let layer of group.getLayersArray()) {
        if(layer.filter) {
          layer.filter.invert();
        }
      }

      return applyToGroup(group);
    },
    appliesTo: (layer) => {
      if(layer.filter) {
        layer.filter.appliesTo(layer);
      }

      return applyToGroup(group);
    }
  }
};

const any = (filter, valueToTest) => {
  return (filter.values.includes(valueToTest));
}

const all = (filter, valueToTest) => {
  let filterMatch = true;
  for (let val of filter.values)
    filterMatch = filterMatch && valueToTest == val;
  return filterMatch;
}

const contains = (filter, valueToTest) => {
  return (valueToTest + "").indexOf(filter.values) >= 0;
}

const containsAny = (filter, valueToTest) => {
  let filterMatch = false || filter.values.length == 0;
  for (let val of filter.values) {
    if ((valueToTest + "").indexOf(val) >= 0) {
      filterMatch = true;
      break;
    }
  }
  return filterMatch;
}

const containsAll = (filter, valueToTest) => {
  let filterMatch = true;
  for (let val of filter.values) {
    if (((valueToTest + "").indexOf(val) < 0)) {
      filterMatch = false;
      break;
    }
  }
  return filterMatch;
}

const exactly = (filter, valueToTest) => {
  return (valueToTest == filter.values)
}

const inRangeInclusive = (filter, valueToTest) => {
  let [min, max] = filter.values;
  return valueToTest >= min && valueToTest <= max;
}

const inRangeExclusive = (filter, valueToTest) => {
  let [min, max] = filter.values;
  return valueToTest > min && valueToTest < max;
}

const isGreaterThan = (filter, valueToTest) => {
  let [min] = filter.values;
  return valueToTest > min;
}

const isLessThan = (filter, valueToTest) => {
  let [max] = filter.values;
  return valueToTest < max;
}

const isGreaterThanOrEqualTo = (filter, valueToTest) => {
  let [min] = filter.values;
  return valueToTest >= min;
}

const isLessThanOrEqualTo = (filter, valueToTest) => {
  let [max] = filter.values;
  return valueToTest <= max;
}

const isNot = (filter, valueToTest) => {
  return valueToTest != filter.values;
}

const isNotAny = (filter, valueToTest) => {
  return !filter.values.includes(valueToTest);
}

const isNotAll = (filter, valueToTest) => {
  return filter.values.includes(valueToTest);
}

const isNull = (filter, valueToTest) => {
  return valueToTest == null || valueToTest == undefined;
}

export const _checkFilter = (source, feature) => {

  if (source.filterSet) {
    let value = false;

    if (source.filterSet.mode == "AND")
      value = true;

    let keys = Object.keys(source.filterSet.values);
    let fields = Object.keys(feature.properties_);

    if (!keys.length)
      value = true;

    for (let field of keys) {
      getLogger()("Checking", field);
      let filterMatch = false;

      if (fields.includes(field)) {
        let filter = source.filterSet.values[field];
        let valueToTest = feature.properties_[field];

        getLogger()("Testing", valueToTest);

        if (filter.any)
          filterMatch = any(filter, valueToTest);
        else if (filter.all) {
          filterMatch = all(filter, valueToTest);
        }
        else if (filter.contains)
          filterMatch = contains(filter, valueToTest);
        else if (filter.containsAny) {
          filterMatch = containsAny(filter, valueToTest);
        }
        else if (filter.containsAll) {
          filterMatch = containsAll(filter, valueToTest);
        }
        else if (filter.exactly) {
          filterMatch = exactly(filter, valueToTest);
        }
        else if (filter.inRangeInclusive) {
          filterMatch = inRangeInclusive(filter, valueToTest);
        }
        else if (filter.inRangeExclusive) {
          filterMatch = inRangeExclusive(filter, valueToTest);
        }
        else if (filter.isGreaterThan) {
          filterMatch = isGreaterThan(filter, valueToTest);
        }
        else if (filter.isLessThan) {
          filterMatch = isLessThan(filter, valueToTest);
        }
        else if (filter.isGreaterThanOrEqualTo) {
          filterMatch = isGreaterThanOrEqualTo(filter, valueToTest);
        }
        else if (filter.isLessThanOrEqualTo) {
          filterMatch = isLessThanOrEqualTo(filter, valueToTest);
        }
        else if (filter.isNot) {
          filterMatch = isNot(filter, valueToTest);
        }
        else if (filter.isNotAny) {
          filterMatch = isNotAny(filter, valueToTest);
        }
        else if (filter.isNotAll) {
          filterMatch = isNotAll(filter, valueToTest);
        }
        else if (filter.isNull) {
          filterMatch = isNull(filter, valueToTest);
        }
        else if (filter.isNotNull) {
          filterMatch = !isNull(filter, valueToTest);
        }
      }
      else {
        filterMatch = false;
      }

      if (source.filterSet.mode == "AND")
        value = value && filterMatch;

      if (source.filterSet.mode == "OR")
        value = value || filterMatch;
    }

    if (source.filterSet.invert)
      value = !value;

    return value;
  }

  //When there is no filterSet, everything is shown
  return true;
}