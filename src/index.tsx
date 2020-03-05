import React from "react";
import ReactDOM from "react-dom";
import { connect, Provider } from "react-redux";
import { Action, Dispatch, Store, createStore } from "redux";
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
  job_list: IJob[];
  job_string_list: string[];
  selector_list: string[];
  // data: IJob[];
  // job_of_t: {
  //   [k: string]: string;
  // };
  // ts_of_d: {
  //   [k: string]: string[];
  // };
  // ds_of_t: {
  //   [k: string]: string[];
  // };
  // ts_list: string[][];
  // jobs: string[];

  // selector_list: string[];
  // selector_onChange_list: string[];
  // // button_onClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  save_success: boolean;
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

interface IUpdateSelectorAction extends Action {
  type: "update_selector";
  i: number;
  selector: string;
}

interface IAddSelectorAction extends Action {
  type: "add_selector";
}

type TActions = IUpdateSelectorAction | IAddSelectorAction;

// class App extends React.Component<IAppProps, IState> {
//   dirtyHistory: boolean;
//   dirtyDump: boolean;
//   history: IHistory;
//   store: Store<IState, TActions>;

//   constructor(props: IAppProps) {
//     super(props);
//     const ts_all = new Set<string>();
//     const ds_all = new Set<string>();
//     const job_of_t = {} as {
//       [k: string]: string;
//     };
//     const ds_of_t = {} as {
//       [k: string]: string[];
//     };
//     const ts_of_d = {} as {
//       [k: string]: string[];
//     };
//     for (const job of props.data) {
//       const ts_unique = Array.from(new Set(iterate_string_container(job.ts)));
//       const ds_unique = Array.from(new Set(iterate_string_container(job.ds)));
//       ts_unique.forEach(t => ts_all.add(t));
//       ds_unique.forEach(d => ds_all.add(d));
//       for (const t of ts_unique) {
//         job_of_t[t] = JSON.stringify(job);
//         ds_of_t[t] = ds_unique;
//       }
//       for (const d of ds_unique) {
//         ts_of_d[d] = ts_unique;
//       }
//     }
//     const ts_list = Array.from(
//       ts_list_of(Array.from(difference(ts_all, ds_all)), ds_of_t),
//     );
//     const jobs = Array.from(new Set(Object.values(job_of_t)));

//     const state = {
//       data: props.data,
//       job_of_t,
//       ts_of_d,
//       ds_of_t,
//       ts_list,
//       jobs,
//       selector_list: [],
//       selector_onChange_list: [],
//       // button_onClick: (e:React.ChangeEvent<HTMLButtonElement>)=>{
//       // },
//       saveSuccess: true,
//     };
//     this.store = store_of(state);

//     this.dirtyHistory = false;
//     this.dirtyDump = false;
//     this.history = {
//       prev: null,
//       value: state,
//       next: null,
//     };
//   }
//   render = () => {
//     return (
//       <Provider store={this.store}>
//         <Selectors />
//         <Display />
//       </Provider>
//     );
//   };
// }

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

const update_selector = (
  e: React.ChangeEvent<HTMLInputElement>,
  i: number,
) => ({
  type: "update_selector" as const,
  i,
  selector: e.currentTarget.value,
});

const add_selector = () => ({
  type: "add_selector" as const,
});

const Display = connect((state: IState) => ({
  job_string_list: state.job_string_list,
}))((props: { job_string_list: string[] }) => (
  <div id="display">
    <ol>
      {props.job_string_list.map(js => (
        <li key={js}>{js}</li>
      ))}
    </ol>
  </div>
));

const Selector = connect(
  (
    state: IState,
    ownProp: {
      i: number;
    },
  ) => ({ selector: state.selector_list[ownProp.i], i: ownProp.i }),
  (dispatch: Dispatch<TActions>) => ({
    update_selector: (e: React.ChangeEvent<HTMLInputElement>, i: number) =>
      dispatch(update_selector(e, i)),
  }),
)(
  (props: {
    selector: string;
    i: number;
    update_selector: (
      e: React.ChangeEvent<HTMLInputElement>,
      i: number,
    ) => void;
  }) => {
    return (
      <input
      className="selector"
        value={props.selector}
        onChange={e => props.update_selector(e, props.i)}
      />
    );
  },
);

const Selectors = connect(
  (state: IState) => ({
    n_selector_list: state.selector_list.length,
  }),
  (dispatch: Dispatch<TActions>) => ({
    add_selector: () => dispatch(add_selector()),
  }),
)((props: { n_selector_list: number; add_selector: () => void }) => (
  <div id="display">
    <button onClick={props.add_selector}>+</button>
    <ol>
      {[...Array(props.n_selector_list).keys()].map(i => (
        <li key={i}>
          <Selector i={i} />
        </li>
      ))}
    </ol>
  </div>
));

const App = () => (
  <React.Fragment>
    <Selectors />
    <Display />
  </React.Fragment>
);

const root_reducer_of = (state_: IState) => {
  return (state: undefined | IState, action: TActions) => {
    if (state === undefined) {
      return state_;
    } else {
      switch (action.type) {
        case "add_selector":
          return produce(state, draft => {
            draft.selector_list.push("");
          });
        case "update_selector":
          return produce(state, draft => {
            draft.selector_list[action.i] = action.selector;
          });
        default:
          const _: never = action; // 1 or state cannot be used here
          return state;
      }
    }
  };
};

const run = (data: IJob[]) => {
  const state = {
    job_list: data,
    job_string_list: data.map(x => JSON.stringify(x)),
    selector_list: [],
    save_success: true,
  };
  const store = createStore(root_reducer_of(state), state);
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
};

const main = () => {
  fetch("api/" + API_VERSION + "/get")
    .then(r => r.json())
    .then((data: IJob[]) => {
      ReactDOM.render(run(data), document.getElementById("root"));
    });
};

main();
