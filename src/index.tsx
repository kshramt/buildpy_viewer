import React from "react";
import ReactDOM from "react-dom";
import { connect, Provider } from "react-redux";
import { Action, Store, createStore } from "redux";
import produce, { Draft, setAutoFreeze } from "immer";

import "./index.css";

setAutoFreeze(false); // Refs in the cache should not be frozen.

const API_VERSION = "v1";

interface IHistory {
  prev: null | IHistory;
  value: IState;
  next: null | IHistory;
}

interface IState {
  data: IJob[];
  job_of_t: {
    [k: string]: string;
  };
  ts_of_d: {
    [k: string]: string[];
  };
  ds_of_t: {
    [k: string]: string[];
  };
  ts_list: string[][];

  saveSuccess: boolean;
}

interface IAppProps {
  data: IJob[];
}

interface IJob {
  data: TContainer;
  desc: null | string;
  ds: TStringContainer;
  i: number;
  key: null | TStringContainer;
  priority: number;
  serial: boolean;
  successed: boolean;
  t: string;
  ts: TStringContainer;
}

type TStringContainer =
  | string
  | {
      [k: string]: string | TStringContainer;
    }
  | TStringContainer[];

type TContainer =
  | null
  | number
  | boolean
  | string
  | {
      [k: string]: string | TContainer;
    }
  | TContainer[];

interface IStartAction extends Action {
  type: "start";
  k: string;
}

type TActions = IStartAction;

class App extends React.Component<IAppProps, IState> {
  dirtyHistory: boolean;
  dirtyDump: boolean;
  history: IHistory;
  store: Store<IState, TActions>;

  constructor(props: IAppProps) {
    super(props);
    const ts_all = new Set<string>();
    const ds_all = new Set<string>();
    const job_of_t = {} as {
      [k: string]: string;
    };
    const ds_of_t = {} as {
      [k: string]: string[];
    };
    const ts_of_d = {} as {
      [k: string]: string[];
    };
    for (const job of props.data) {
      const ts_unique = Array.from(new Set(iterate_string_container(job.ts)));
      const ds_unique = Array.from(new Set(iterate_string_container(job.ds)));
      ts_unique.forEach(t => ts_all.add(t));
      ds_unique.forEach(d => ds_all.add(d));
      for (const t of ts_unique) {
        job_of_t[t] = JSON.stringify(job);
        ds_of_t[t] = ds_unique;
      }
      for (const d of ds_unique) {
        ts_of_d[d] = ts_unique;
      }
    }
    const ts_list = Array.from(
      ts_list_of(Array.from(difference(ts_all, ds_all)), ds_of_t),
    );

    const state = {
      data: props.data,
      job_of_t,
      ts_of_d,
      ds_of_t,
      ts_list,
      saveSuccess: true,
    };
    this.store = store_of(state);

    this.dirtyHistory = false;
    this.dirtyDump = false;
    this.history = {
      prev: null,
      value: state,
      next: null,
    };
  }
  render = () => {
    return (
      <Provider store={this.store}>
        <Columns />
      </Provider>
    );
  };
}

const Columns = connect((state: IState) => {
  return { n: state.ts_list.length };
})((props: { n: number }) => {
  return (
    <div id="columns">
      {[...Array(props.n).keys()].map(i => {
        return <Column i={i} key={i} />;
      })}
    </div>
  );
});

const Column = connect(
  (
    state: IState,
    ownProp: {
      i: number;
    },
  ) => {
    return { ts: state.ts_list[ownProp.i] };
  },
)((props: { ts: string[] }) => {
  return (
    <div className="column">
      <ol>
        {props.ts.map(t => {
          return <Node t={t} key={t} />;
        })}
      </ol>
    </div>
  );
});

const Node = connect(
  (
    state: IState,
    ownProp: {
      t: string;
    },
  ) => {
    return { t: ownProp.t, job: state.job_of_t[ownProp.t] };
  },
)((props: { t: string; job: string }) => {
  return <li>{props.job}</li>;
});

const store_of = (state: IState) => {
  const _state = state;

  return createStore((state: undefined | IState, action: TActions) => {
    if (state === undefined) {
      return _state;
    } else {
      switch (action.type) {
        case "start":
          return $start(state, action.k);
        default:
          // const _: never = action; // 1 or state cannot be used here
          return state;
      }
    }
  }, state);
};

const $start = (state: IState, k: string) => {
  return state;
};

function* iterate_string_container(
  x: TStringContainer,
): Generator<string, any, undefined> {
  if (typeof x === "string") {
    yield x;
  } else if (Array.isArray(x)) {
    for (const k in x) {
      yield* iterate_string_container(x[k]);
    }
  } else {
    for (const k in x) {
      yield* iterate_string_container(x[k]);
    }
  }
}

function* ts_list_of(
  ts: string[],
  ds_of_t: {
    [k: string]: string[];
  },
): Generator<string[], any, undefined> {
  if (ts.length > 0) {
    yield ts.sort();
    let ts_new = [] as string[];
    for (const t of ts) {
      if (t in ds_of_t) {
        ts_new = ts_new.concat(ds_of_t[t]);
      }
    }
    yield* ts_list_of(Array.from(new Set(ts_new)), ds_of_t);
  }
}

function* difference<T>(a: Set<T>, b: Set<T>): Generator<T, any, undefined> {
  for (const x of a) {
    if (!b.has(x)) {
      yield x;
    }
  }
}

const pushHistory = (h: IHistory, v: IState) => {
  return (h.next = {
    prev: h,
    value: v,
    next: null,
  });
};

const assert = (v: boolean, msg: string) => {
  if (!v) {
    throw new Error(msg);
  }
};

const main = () => {
  fetch("api/" + API_VERSION + "/get")
    .then(r => r.json())
    .then((data: IJob[]) => {
      ReactDOM.render(<App data={data} />, document.getElementById("root"));
    });
};

main();
