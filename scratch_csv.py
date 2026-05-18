import pandas as pd

df = pd.DataFrame({"Nopeg": ["098765", "123", "0012"]})
df["Nopeg_fmt"] = df["Nopeg"].apply(lambda x: f'="{x}"' if x.startswith('0') and x.isdigit() else x)
df["Nopeg_tab"] = df["Nopeg"].apply(lambda x: f'\t{x}' if x.startswith('0') and x.isdigit() else x)

df.to_csv("scratch/test.csv", index=False)

with open("scratch/test.csv", "r") as f:
    print(f.read())
