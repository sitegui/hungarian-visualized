'use strict'

let hungarian
let builder

builder = new Vue({
    el: '#builder',
    data: {
        size: 5,
        seed: 17,
        custom: '7 5 2 0 8\n' +
            '3 6 7 0 9\n' +
            '2 9 4 1 7\n' +
            '2 5 1 7 5\n' +
            '1 3 9 5 0'
    },
    methods: {
        build_random() {
            init_hungarian(get_random_costs(this.size, this.seed))
        },
        build_custom() {
            init_hungarian(this.custom.split('\n').map(row => {
                return row.split(' ').map(x => parseInt(x))
            }))
        }
    }
})

function get_random_costs(size, seed) {
    // Based on https://en.wikipedia.org/wiki/Linear_congruential_generator
    let a = 1103515245
    let c = 12345
    let m = Math.pow(2, 31)

    let costs = []
    for (let i = 0; i < size; i++) {
        costs.push([])
        for (let j = 0; j < size; j++) {
            seed = ((a * seed) + c) % m
            costs[i][j] = Math.floor(10 * seed / m)
        }
    }
    return costs
}

function init_hungarian(costs) {
    let n = costs.length

    // agents = rows
    let rows = []

    // tasks = cols
    let cols = []

    for (let i = 0; i < n; i++) {
        rows[i] = {
            i,
            str: String.fromCharCode(65 + i),
            label: 0,
            // A reference to the col currently matched to this row
            matched_col: null,
            visited: false,
            // If the algorithm is actively here how
            head: false
        }
    }

    for (let j = 0; j < n; j++) {
        cols[j] = {
            j,
            str: String.fromCharCode(97 + j),
            label: 0,
            // A reference to the row currently matched to this col
            matched_row: null,
            min_delta: null,
            // A reference to the row that produces the min_delta
            min_delta_row: null,
            // A reference to the parent row to for the augmenting path from this col
            path: null,
            // If the path is actually part of the augmenting path
            is_path_real: null,
            // If the algorithm is actively here how
            head: false
        }
    }

    hungarian = new Vue({
        el: '#hungarian',
        data: {
            n,
            costs,
            rows,
            cols,
            // The row and col that contains the current min delta, and its value
            min_delta_row: null,
            min_delta_col: null,
            min_delta: Infinity,
            next_step: label_rows,
            next_step_str: 'Label rows',
            // drawing size constants
            d: {
                // node radius
                R: 15,
                // rows' x
                X1: 100,
                // cols' x
                X2: 300,
                // node margin
                YM: 10
            }
        },
        methods: {
            do_step() {
                this.next_step.call(this)
            }
        }
    })

    builder.$el.style.display = 'none'
    hungarian.$el.style.display = ''
}

function label_rows() {
    for (let row of this.rows) {
        row.label = Infinity
        for (let col of this.cols) {
            row.label = Math.min(row.label, this.costs[row.i][col.j])
        }
    }
    this.next_step = label_cols
    this.next_step_str = 'Label columns'
}

function label_cols() {
    for (let col of this.cols) {
        col.label = Infinity
        for (let row of this.rows) {
            col.label = Math.min(col.label, this.costs[row.i][col.j] - row.label)
        }
    }
    this.next_step = greedy
    this.next_step_str = 'Greedy allocation'
}

function greedy() {
    for (let row of this.rows) {
        for (let col of this.cols) {
            if (col.matched_row === null && this.costs[row.i][col.j] === row.label + col.label) {
                row.matched_col = col
                col.matched_row = row
                break
            }
        }
    }

    this.next_step = find_unmatched_row
    this.next_step_str = 'Find unmatched row'
}

function find_unmatched_row() {
    let unmatched_row = this.rows.find(row => row.matched_col === null)

    for (let row of this.rows) {
        row.visited = row === unmatched_row
    }
    for (let col of this.cols) {
        col.path = null
        col.is_path_real = false
    }

    if (unmatched_row === undefined) {
        this.next_step = null
        this.next_step_str = 'Done'
        return
    }

    unmatched_row.head = true

    for (let col of this.cols) {
        col.min_delta = this.costs[unmatched_row.i][col.j] - unmatched_row.label - col.label
        col.min_delta_row = unmatched_row
    }

    this.next_step = find_cheapest_link
    this.next_step_str = 'Find cheapest link from any visited row'
}

function find_cheapest_link() {
    this.min_delta = Infinity
    for (let col of this.cols) {
        if (col.path === null && col.min_delta < this.min_delta) {
            this.min_delta = col.min_delta
            this.min_delta_col = col
            this.min_delta_row = col.min_delta_row
        }
    }

    if (this.min_delta !== 0) {
        this.next_step = update_labels
        this.next_step_str = 'Update labels because cheapest link has non-zero extra cost'
    } else {
        this.next_step = follow_zero_link
        this.next_step_str = 'Follow zero extra-cost link'
    }
}

function update_labels() {
    for (let row of this.rows) {
        if (row.visited) {
            row.label += this.min_delta
        }
    }
    for (let col of this.cols) {
        if (col.path === null) {
            col.min_delta -= this.min_delta
        } else {
            col.label -= this.min_delta
        }
    }
    this.min_delta = 0

    find_cheapest_link.call(this)
}

function follow_zero_link() {
    // Add to path
    this.min_delta_col.path = this.min_delta_row

    // Update head
    for (let row of this.rows) {
        row.head = false
    }
    this.min_delta_col.head = true

    // Update real augmenting path
    for (let col of this.cols) {
        col.is_path_real = false
    }
    let col = this.min_delta_col
    while (col) {
        col.is_path_real = true
        col = col.path.matched_col
    }

    if (this.min_delta_col.matched_row === null) {
        this.next_step = augment_path
        this.next_step_str = 'Flip matching in path to augment it'
    } else {
        this.next_step = follow_link_back
        this.next_step_str = 'Follow currently-allocated link'
    }
}

function augment_path() {
    let col = this.min_delta_col
    let parent_row = col.path
    while (true) {
        col.matched_row = parent_row
        let temp = parent_row.matched_col
        parent_row.matched_col = col
        if (temp === null) {
            break
        }
        col = temp
        parent_row = col.path
    }

    // Update head
    for (let col of this.cols) {
        col.head = false
    }

    this.min_delta = Infinity
    this.min_delta_row = null
    this.min_delta_col = null

    this.next_step = find_unmatched_row
    this.next_step_str = 'Find unmatched row'
}

function follow_link_back() {
    let matched_row = this.min_delta_col.matched_row
    matched_row.visited = true

    this.min_delta = Infinity
    this.min_delta_row = null
    this.min_delta_col = null
    for (let col of this.cols) {
        if (col.path === null) {
            let new_delta = this.costs[matched_row.i][col.j] - matched_row.label - col.label
            if (new_delta < col.min_delta) {
                col.min_delta = new_delta
                col.min_delta_row = matched_row
            }
        }
    }

    // Update head
    for (let col of this.cols) {
        col.head = false
    }
    matched_row.head = true

    this.next_step = find_cheapest_link
    this.next_step_str = 'Find cheapest link from any visited row'
}

// let hungarian = init([
//     [3, 1, 4, 1, 5],
//     [9, 2, 6, 5, 3],
//     [5, 8, 9, 7, 9],
//     [3, 2, 3, 8, 4],
//     [6, 2, 6, 4, 3]
// ])

// let hungarian = init([
//     [5, 6, 7, 4, 8, 4, 9],
//     [2, 6, 6, 9, 0, 4, 2],
//     [6, 5, 2, 4, 0, 7, 6],
//     [1, 8, 2, 9, 1, 8, 8],
//     [0, 3, 8, 9, 4, 6, 8],
//     [6, 5, 7, 8, 2, 8, 7],
//     [8, 9, 3, 2, 4, 6, 8]
// ])

// let n = 5
// let costs = []
// for (let i = 0; i < n; i++) {
//     costs.push([])
//     for (let j = 0; j < n; j++) {
//         costs[i][j] = i * j
//     }
// }
// let hungarian = init(costs)