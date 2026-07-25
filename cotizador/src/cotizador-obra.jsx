import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Settings2, Save, FolderOpen,
  FilePlus2, Eye, Pencil, Printer, X, Building2, Calculator, Info, HardHat,
  ClipboardList, Wallet, Layers, BookOpen, Users, PackagePlus, Download, FileText, ArrowLeft, TrendingUp, DollarSign, Copy, Upload, Search
} from "lucide-react";

const DEFAULT_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAVQAAAAnCAYAAABQU7BuAAA4o0lEQVR42u29eZhcVZk//nnPOfdWV29ZSJrsgRBCujoBtFFE0UokaNLdYXGsuOuIgDjKfB03vsx8nU6No4PjNo4OOkFEUUfMHRdCNkBNSlAYSSuBdCXEEJJ0dzrpbL1X1b3nnPf3x63qdJbeO0Hnx3meep4sVfee8573fN79PcAr45XxynhlvDLGZdBYfswAeQmIBBLY2tZGSyoq2IOHRAyMJJgA/v87gRkg1IO8NCiBBADgFRq9Ml4ZrwBqCBD1EFu3xsXSVEoP+d1EQgIAeZ7FKIBjbQIyAcAbwW8K4A4AW1MpmwTsSNaGNMjLPweeZ0cDeAzQ1nhcHqlI8SoPZqg1Tm2L05JUyoz0XQwQEgnhwQuhOgam5MDr7U/P4Xz/fNHr1PVAeH17OfY5jqdg9BIQibY4bQXQpzwUZtrWRqio4LHwjJeAGMlvzpVQrgfEknhcIL/OUAU49WwtWZKyY+UdLw1KeLDjMf+1CUgAGOy8nQ8a04gOD4D+RGx768LpOUlzJGiSJZTBUsaS7XSk0zStc1IT9QPdtQnIocDlnByEBOT5OpQFgCPP61tn6/WXlwhppmnF08FUYpiJiXuKBLXarGqd/vhzPacIoDGC0mjm/BegJRNepjkWhONwFIhT9jHmnTdBUJjjaITy6WfFGwKUzsbv55tnXxY+qIdAOkH9z/aoAZUTCVl40KGViy4H8zsN8zIGVUqiUlcQHEEwluEzQ1vOCaK9AnhSG3gzN+14vA/chpBIzCAi8IsrF13oWvsdSYgYHnqiXFgMo1tK8SJZPKsV/2bWw41NgwF6AVC2VVc70yoy90ckTctZ6ImOVMf94N45m3b+Ym0iIVcNQcj+z2+pWzDFIedGY1EHwqssY7oS5CoKV6GZoa0NBNFBAH8QxA/3djoPX5za3l7YvME1zXA+LTWxd01w1AePB0aXOUJlAtM4Y2P67/qDZOHPLy6bN8Fxi+53BJUbhilTUnUE5udzNjbe239/RwJuTTWL7i1WNL9HWz3ZkarDt/fO3LRjWPQ62x4cueGysqyW31eCSjXDTHKkbA/Mz2dtaPwW19cLSibPq6bany4cj6vWsqOvAqjaAgtheaYAlxlQDuA2kNgbFdjWY2nb3A3PnyjwOw0BTv3XbqyzKLDGshCDrlMJYm2scAT3QDlHpv/8ubb+oEgjVFwKbqkCzx2ovWJmhPTrQFisLeYyeCozFIiOOwL7LSPtgJ6Zun7Hrv6AM1wBwgC11MSuKHNF9KgTSV/iNXSMUrATAH4pPrcoWl5+pW+NnT0z+kda0xCcjcZNyxfPKi/i2R2BNSDiIWlsmXSgO8siODh13QtdfbQKX3zW36vhMlVTbeWlrpCrwZwoUdLxLSNrLbRlq9laaLIgJmISRIgoQmWRFJW+4NsO1y16gpn+ibznfzmkVrQ6JFIx/GKQU1eqBAqAysOksCSCFUCvMV2H66rW5djcM8fbtWMwLbl8aoew5K4oc+QU0hYlrsRxrR8FgKl5M2coGu284bKyiezcRcy3RaWssIKRtQzDjMBaHTCFDEcsAHIk0dyIoLmCcLMt0y0ttbH/8Lt7vkbJ/dnB5lqYjyVaWOLK6zPWokxJ9Go7daA5RpVwLVFduZIRnxmCgCJBS5trYr8jz3t2pCAY7iNfV6bUAsuMEleiPTCPDYdep4+t8bhEKqVzRr5tRtS9uTMwAAGKCMx8eev1lz+IZLL3fGnTIcDUEyWTZsdbYpMvdOlDh/joe6NCXD4xovokf4EvhQiXm9EWfqBbD9VV/XcGwb3k7d41JL8nIODB+EZcWeaI3/RqoNwRoEFUCAYAKRFYi27fdrfWxrYLgUcyvn2QvF2tIwG3tQUAToIP1VYuA4nbLOsVk11VpmRoHVvLYACSAIR7gkNZzYfrYluNFd99smTHjykJMxSY99Hh9mqFluxPo0LOc3qzywE8mtd0R8Z/oRBgpzg6RxGe0kz6cGtuFoDDp9A8z19C8h1FQv5DTgBlSoLBA9I5pDGjVwgE1rYcqqv6HQT/kNal1+X/X9BZ3IlqKDWXkp45UFP1oYigr0SlmNARGJzwdQAQA1CuJKFICEEAc6h9+ZaRNTbIGWYGVKkj3miYHz9YW/WNg4eKPkkNDUF9PURykE1nI60Bd3UGptgiXLsgkpR/z9lUJgswwAYgA2YhBZWVKfkeYejm5rpFn5zl7fj2YMAhQO2dgZnkW/a7fO0CyA21qVvicUWep/etiL05auneUkdc1hVYtAdaE8gww4mENFKSwpkaBnzLyBlrfEuawdIVYma5kl/oLitLvLh80V9f4u14bigGFUSZLl+brLF+Z6BdZnQNSE8lmC23dwZmig7paUsc4foW9+9IxK6pQogPIwEsAeroDML3d/nataDcaABsayplGaAmxh0dgTa9mg2DZTesKXfUhd2kbyLgR1vicYURmN6jBlMAlEzalprYuxxJ/zzZdeYFlnHc1we6e/0nibgBoBYyNkckhCGeIoArAHpjsRKLJzryzsNZ3NJaW/XlJ4obP0fe0LRVQlhtmQO2vcd9u5V5cEAkgmCmqUR86aSI84aIoDcchf54U23sHymZvm84ArKgCLxUE5tWRPQVR4p3T3YVDmUDtOWC31ngtySQJis6YA1DUAmRmG+Zr2bwmy4scpf61i59Y2bRR5qW60+St+vp4Vo7DAS+ZWYau4BkQexbZgb8wb5nwdoC7Bu756ixu0Ag8MDvJyDChNmSqHJakZPo1jZxuHbRIxmtP0yP7mo9G6iqQYmd9ExzTdUXJrjy7m4dggQzyBHCKVUCPdoisHzIB7cSuB2gYgDTAMye6ConZxkZbUx3YAyBMDki76Tp2crdy+f/1YLkns5hHGBJRBIMJgJZcAeYfPAZjmUmggBzkSNEcYkSKmMsssaa9kCzBBVPdOS3XqpZKC72vHsHYjYGSyIh+713OJqpbqqpfF9UigdAJI/7WgOAIqFKlVDd2iJn+IAP3s/AMQo38UIGzytWssIRJDsDA99Yc8JaW6rkq4h4y0vLF9aSt+vpwbQNyyzC+VI4X7JDONzz32NmIqgebfQkV73adOvP0ibvsyMFrJP0Cp9L4JEHOfNC47a6RdcUEa7uNcxMcApGlQXDMN0B4EdbUyl7rsF0dT1o9Wpwc13V18uU/FtXEg5ngwYGf82VZt2MvOk3ED8c7U2/8ZCxfxeV4oaIEPXX9i665qUb5Tvo4e3tg/G71kBxhAiajs3a2Fg33Dnvr1086WgueCOB/s8ER745KsWaphWVM2d73urBrJwC8O2rqXp9kcCPpkTURW1Zbdoy/n0k6Fsz16efG+y9B2sq57Zm/fdL0EenFqnXnyD8et+Kqr8lz/vOlnhcDcPnTDTGLKPTwG/I5zGzLVKCmPDw7A3pTw/nuVvicbWg7Nj8gxn/PQT6eEWRWtmW5UsP1F6xDBu2HzwdVNXATO6ZphWVqydH1N0n/EBbJkEAlTtK9mh9ojvgBwzjpxGln5/aj8k4EXMP9doFPZreAuZbJrqqqiMwsAw+5uvgAlctsxz56e7l8+tQtkfzcKJ8DFaCyGis0lI845RklA1U3yKsI1hktNCiqExZPbVT2zcT6LZyR87rCqw1gO0KDBdL9fUDKxY/Mcfznh+NiXs2Gu1bHntPsZIP5qxlY6wBQGWOlD3adnVp/V1D9iEu6d4+22vOnH4QcoF+XZboA0rQKimEzBimzsCYYiUmFyu1oam28nWU3LlnJCbcCNlQdgbGRKW4+0Bt7JE5G1K/H40PbiwjjJN7gLV3RF1FOauNACklCL5l0a0tu4LecLCu6jUz1jduG+u+DRVgSSY9c8szlT+cVqTec8I33G3s6m7jf3HB5j25AhD1RborKnhrWxstAYCKCs5rZlsBbG2pqfpQluy/XxBRb2nL6YcPJF633MPT/lD8TsSC66qLEZ2X68scGIBy5MHk/bXrAKxrrltUXySwusxV9S21i7bP9Hb8/Gz7uTYPpi/WVr6xiGjDREeWtWV1oyS+48L16SdPCXTlF1RYK1CI8O/cD+BzL731sh+0Zfnfyx21UhLft29FrOiiTalvjtAvf54jnBzhREL+qatLXVpWNjDwxzymZEoD2AXgswdXLHq4Lat/OjWiFh7MBj9EAssQZgH0eSTV2QIe5HnmwIrKm8pdp/6EH2gLkoJgS5WUGWt/woTPzFjfeOBs/hHy0j6AHQB2vBSfe68tLfm0Q2K1IQhtoY7ldDAl4izTOXyFPHwsH9keFuFdaY7N3NB4YpCvHAXwEoDfvxSf+20qK72vzBFv7wqs1WCeKKXyjf4HAO9MjDHiR0mY/bULq6MkvhtYa40Nt2qCI2WPNpuM4L+d80h6T3/6eAmIvjSM8CBsArCprabyXiPld0qUuLRXW5sxVk9w1OTAt/fV1+PN5zLSbZhRJIWUhv6TE7GrgbQ5X77KekCs8jzTdvPC6b5PN3dpww4Jpa097FukolKs6tUmKHGk0x7oDwN4JnGugD2REKs8zxyoiX1+asR5T7tvfG34/bM2pX8CgLbE42pJKmWGAAniBASQAHne/U21la0nfP3Tqa5605Heri+u2oC/XTscftcdhjxvWPtwMnUOmOV5yaba2OwLI86Huvzg8y/F526Ctz93SpAy78ZrXXn5xWDz0wmOKDvu6yeZgpsvXL/76JZ4XPWlRA2kZaby743HJT2a2gfghoM1Vd8odcXHSpX8xv6ayibyvIfPlfAbB0hl8jyzJR6nBZs3Dxk0RD2oMR1TM7wd216sjSVO+OZXF7hqSVNv7J1zkukf9dfIxek/bvQ8bqlbMEVK8a2ctWyZBHEIpl3a3jPtkR3vnLk+fWBLPK64HuL0qBcDxPUQHI+ri1P7szM2pD+XZXuzIuQcAQ7N4kCXKfHRfXWV15HnmUK+6pCH38BhgLbEoTh04p76qYfgeoht1dXOxan97S2tRe/u0bYxKkmAQd3aMohWHFx+5dQCw452S3YkYq6AvM+R5AaWGQBPcKXsNmbN9A2NNXMeSe/hfjQigFd5MJQMNRQOD5/keFxVbNz5m86A3qyt3VskiQASHYHW5a6K3/pM1U2UhOVEQow3WzlEBCLRY4ye6Mgr9/fwavJgEI/L88HWhVzHwJfvm+jIMsPwS5WAJXpc+fLOIMyEUN3asAD91aGViy4kzzP1wLjSonDwW2urlkSluDtjLOdg75i1qfEnfHu1wwCWplJ6GEKGyUMIhomYO3vDzo0B8+qctXAIH9lfu7h6leeZQs7kOJm6ec3YAwOC4dQf9XVnqSMrVXHJ6wlgnMY7axOQvtb3X+Cqqcd8vfN4wDfOXL/7KOeBYTjWEAFMqZQunLkZGxvvbM+ZtSVKQJJYs/+Gy2YkPM+O916df202TLlc5KV9vr3auWRD+vdZa+8vkYIF6HYGqL8r6tTFJhIiCVhrnf87UclpWWMtwFzuStmtzfdmbWi8e0sciushCoQ/nckKE6BUSjNAfHu1M3dDel1G8+1FUgiAYTnMHxIsvszxuEKY+D8s5zMBfKQiTLQ945OEpSTsVQ0NwbbqaueqhoZAW/vNiBQgAgeWUSSp3JC/ONRKRr7ZW+JxRUnYCb34wCRHvqpbGw0QyhwhOwOzecb6xg8zINYmIGkAGp08CDCUSmm+vdpZsPn55h5tbgFgBKBD5ZEDAt9aMD/G1cRlWM32oENEDJIdgTHFQt61r6bq9ZRK6fE89ANJ/iWplOFEzLXgD2WMBcDStwxF9r+mP/5cm2F+rEwJ0gx/giMnam3f0x+Ix2skPM9yPK4C5q9MchV1a/ODOevTD2y7vdqhNQ3BqLR1Lx1wIiE7ivG1zsDsujDqKMHmU2Fgf/z17FUezGoAczZsbzGWn57oSiaiawCERQd9cRHY1/fE3ndBRC09EeheA/u+RY+lj2+JQ9EoAn4F8K0HRDGX3nYsp/dcWKQqSKvVBPDqRILwv2WcaAgFBOG/jvgazLiq5caqWUnAFpQzcYrJ7nmm9ebLK4hwa6e2TAAiUohubfapYr6T6yG2pjDsCgkCmNY0BNtur3bmbmp8sEtbb4KjBMDo0caUKXFlS/HR5QTwlnhcjefaq+saDAPkOHJbj7ZgkBTEJiKIiTAHAKa2xWlUILB8foSZPp01lsEgJSAy2razEbflgZpGUsRAaxoCjsfVvM27UlnNv5xR7LilSkYcQY6StKJp+eJZlIQtFFeM3eBhW6yEYGB1wPxsmRRkwFYKEor4Oy111cVAAjyOQYMzIvvxuCSAW3rl8lIlF2SN1cVSqh5t0906+DUDBKL/tCH6i6xlWIFb+fZqZ0kqZTBOc9sSjysCuLX46I2TXPXqtqzfXkzO3zNA1dMbRm2uFkB4UegC+7eMti0gzD+ciJWO1ToaaKyOx/PWEO0GETF4FvL+XQYInmd5+fyIBe6KSIKv7f1zN+xqCE1WjDp7gpKwS+JxMWXz7zsZuKtXWziE97atuHwBeZ4ZL7592YcHmwTscV815gy3TnBlMWtcUlBGTwHUrXkzzwT2bRMcOSGw1gJAkRRkLN1zoZfu3ro1LkZSytkHbtNDcAus+X+92maFIAECC4Ah+IOhgz817j47AtiCunxrtcj7ICURWUIpACwZsSqTEARwsyy6rkyJS3sNMwhcpiQFlv9j9ubnmzkeV6OqCFsSpg6RpH/q8O3Xu439ylHffI2Zvq7ZD4VNcnz8mkxgVxAM24PW0m0gQCA0/Se5qtLY7OdWeZ7BOXAz9C13SWgmMexHQp8RmYggEPDAgs17cl4iIYKu7se7tXmxSAonY4wuU7KyuSV3fV4Ay/GchxG4tVQJ1ozvTdmwvQWJxJgDgQXgnLUxvea5TG8sY/zr0m1Ts/0B91zwPAg9+cPtnsG7Qi2b4KiFbVndJSR9Oa8kjDnguTRv/s96TeMv2gPzTEXUifrC3AIAW7fG/1cAamHPrnz8uR4itBZJgmVb0f874nTGgrUrLTMLgnWlkJ2+Puz7kYcK2tloJRjqQZds2rXbt/bxUimIAM4YJmZ604kbr5hYyNUbb7NSGJS6QigLMDOEtsxsqRMIo5ejjBLeqASxIDYCJLu0ybpCfpcBwpLRMWfBNTBr/Y6nJj783Mdnr2/81JwNjZ+Yvn7Hxy9+9IV9430IDTMkyQvmbtqxrdM3905wpASADt+YIkkf3788di2Ns7/vtKCe3bc8FnMI13VrayXB7QhMl1H6vwAghkZ5cWp/lhgPRqUAQEYAYLYfOYVfx2EeLXWxOQKIH8lpKJI/ZIC8EXWQGMJKA/h1m/d0Lti8p3PpucyjzWcEMHAhCLDgE/1N/lBuqZvLXcGWecPM9ekDXgi045JBsnVrXFASVhEetMywjJV8e7WzNJUy59LaeTkG9+0vyTMAlRGWnW2rm15sgcVZy4YAHRWkmSh1yS8bOrwExJgO9NbQHJFM6wAYgExgbeAKmtTr66rR+jQHGg3rqyUBHFh+TYkSANiASOQskxL2pVFpxZ5nOQFJzFf7lokZKJaCtMW2aRue39vfpzQQwA/5SSQk317tbKs++TlXzMhgUw+IolLc1R7oXSVSKgO2kkg4ku5rvf7yknNi+qdDv5qSdGuJkg4Av1RJsoxH5q574eDaREJWeWkNANKYBzsDkxGA26UtOyTe0rxi4QJKwvJYAx55zYkNXTMloqJZY1+YPtN9Lh9AtON8AOmcg4rnWQbIWn6V1gxB9AIANHR3UyFQxszX+oYJoI0MUGKEVW3Dsjq0fLwtq7UiXLb/QOZSAIz6v3xALexfS111MRjTfMOQgo6dqaHmF3shT750oqNml0ihipWMlrlKMdAQEj4+JoJ4FSkmgNmxDYpITnBkUakjnYqoI1ny1QAw1DvIMjFAU9sGAaR8lP+qhtB3qwTfmbMWYJBDhJy1R7K53HMFn8hw518fJvDy4eyiKQZ0iR96ROAIgiB+CgCGio6fNZB2+sfzDK1pCK5qOPk5ZylMFpwE7IVeutuAb7fMLECi1xhd7siFvgr+ZbxN/4Kv/qUbr5jI4Pf0aguAlW8ZYL4fCLtMEWDXJhJy+qMv7NPgTWWOJAC5Mke4LMSteTfVmOZVsFCswJWuJBDwLK1pCPJZJ0OmKxUi3MP5oD5MvzlnwrG62gnr1Re9qUSJxUd9nWNrUwDQVVrKAHCgV84iwrxjvmYr7R8IYCwZx2KJvEtq5lx3r2XeM9lVUgle9L/F7PcSYcaO5eylrsC0Dt/4xue9APqCxgoAVifzZqAIOrs17uGwRAuWIZXh9QQwj9HPksiDVxfsHgT6H0EcZSs0s3YB3l7wIw72DEkqTF0ZzIGeBAMNdltddfHMlux9USVjnUF4akuVoHaff3HJL/d2FBKPh8vgq+uBZBLQxk5XgkrzSYJkGTAcagJDuRD21y6epMiVGLhC9JRRqgSTLqEuoHfm+obec8Uou5fPj8zdsPOJAyuq/m1yRP7d8UDrjsCYEkd9rLmu8mHyvF+NV6J2oW7fNfrt5Y6q6PCNH1XS7dHmuRd7p/6mALgFYA2xldZoy28DWPUYC2J67+7lr/3nBZtTnWPJmV2SN5EFcAlAICF2AehrUTekPy15bgRdU3tW1APCA6h+kLWtrg+1/Ya9ewU1NASt119eYoT+6kTXFQcz/vo5m3btDrskhesk4tklUjjdgTlc5ueax9MvX6DJ2gQkrWkImuuq9kaUWMg+XTyqeMWf4Zi3t1oQGswBcGJKxBUHs8Gzs69J7+XHTjaWUSFNw79c9MjulwDcPQCx7FiJDQCVYVXV5wbyIw4WEdSw5TtvuKwsMBlVZNxTDvckV7JvOeJbZ6oDLCXOfjSqRKwrMJZA7AiSXdp2Sxn8CwM00jQkL11Ii+BySQKGmcEgC4YS9mD/A3qGRgYw10M0bzOPR8hfkDEOD6fsrstnU+760vrGA/Chc1V90nlkguV6iKZ02T+093a9tUTKWK8xAcCSINYcTsSuQMwrNCcZm1mYShmuh2h+hj8c5JtuRAShl+iBpamU2VZdrbihQfc3YRuLeQv3mF2lSi7s1SaY4KrpNtf7VwAeKAD0qCaT5wFmrmBmAObwcA//s9dfXjK3mKZms1mgaODv5SxTRBDDRmiiNKLDUPe0R3YcHkTz5dlPN2eTwxASyWRoZgEwh2+quiTQ+juTHfXqtmzQQcR3F5SFgoAgw1OijkQPmcPbg7095wJ0EvnKN2ZuzZ/qioKy8ZcMqgWrd3/tpfMcEh/xrSUifoCSsP1LttXpTvp9W+e6/f/tmYr9wXj2MWWAsHy+uy8T9J3NfbhID+qsJ5BmBgs8VGZkDlxGp8NuzjADFFGEKeWOJN8yOgNjCGBXCuUQocuYW+au3/3S2gTkquTI1lRgFIIsc4gQMNsCxzOL4QqbYhDKAFjQwIJDEEAghC8gEGhRfwAY79FVWspIJ2iO52Wa6xbeapiekCDRa6ye7Kh5x3rMPZTExzhknDGU6+ar8J6pfGOxlFf1amMcIdyOQJ8gx/4AAF/VcGrrNQAML+0318Xuiwj6Si+IjWUA/GEGvjeW+fTTzlzDDMvUNZSlUVjDJGXqiqV6yLguxCC7EsnXt2XZIIDkwAbfA3DL2YRj+BhSh9562dy2YsqRYRrILIlKYt845ZLtpdryChPg3dOKnInHfNMRwL597oadfyoE3bbE872MBRcaY+UKaVLj7U7qA2+EgV/LiAykbLxsvlBmwfG42goojseHdAktSaUMNTQEu+oWTFGsHprkyslHcjotKPpAPSD6B+vV6RoisD97LhdDACNfF93PGB7WbyXRVMJAul3YiMswo8PXhgGKSCFLpUCPNm0dhj9y8cb0z0bb6LoQ9dVsM4oFmCBQ6Ag0zI45zCgtUwLiZMe3s9EHOcvIGmYCrG9ZMFBSCBziHPng8qV4atb61FP7amJfnOKqvz8RaN3hG1OqxEf311Wto/Wpx8aiJRfi5kTijogkZC3pYilkp2/Xky7JHF9WPSGYlDHHc6ZvjVN9Q+xKDjRtag9MUgqUdmtrixS9tqWm6pqZGxufGi/NnXgYzV1iMc4LvbYebZ7OWmuYBxaORERgaCaeHhF0CXEINDjdrSCZAssAo8IotUv7+VaUAzzX12wZRkWUdKZFJdp9g+O+eawnx5+Z99jO7ZyApNOVhpPrOw8BIpYngzR/XkMQZfJFDMO2bJprFy8jtl+d7KrFHb7ukRDvn7G+oTcvtPgUQC2YpS/VxKYVk3qLz4YliEscQV0wW2c93Ng0DvXdBIAPJF4XRU/nTYrIMWztBUUOHc/q52dtTD87lD/TIYIkOtlM+jTpnjEWDDCIhBMmoR7ogl3bqcXXF2x+vnk8bg1QxD2aC4cFHGqSXD6U7201gFuB9Z3azM5qtqAzDy8BgpkCgCsjUlzmG4ZlJiKUNsZjJUiluxmjT/caljmeSEigMXmw19SVSHl5jzGBZRaKseZ4Yt4ViHldo+GFQt1+841Vs6FxY5c2YMDt0gYQdIO12ZoeF0APcWk/OZ8RCtAAEVsGIswEENsiKZWv9R0E/G7UTFkPQhJMhKwiAhNNHMrkLzS5nr2xcQuAa4b7qgO1sY+5Uvw7swgGOyChAsUdOFnKfeYhCoHaUUSTs8aaIzn+dmDpJzM37HgC6Nfj9DRfsQFyATOYUbZ7+fzIgs17cuPdt6FPE2W+AACYwoBBXxOZl3eQDt1Miw6siL2bSAhme4Z1KUNagSRLwbTAMq6LSlwz0XFwJKsP9Brz/nmbGxvO1rRI9WesCItZJS6+XwIJzYxyV6K9W38SwNcwFl9VuMlilQcjujoWTixy/ivU9gSiSoKFvhvAs2GU/OyBKQKQtfwsgTvzGgHjDHHLV0lBRZbZFEup2n3727kbGj9dYLKxgGnCKzB40SFjc4EgchhgEXL4fB5Qbw5/l0zCJpH+m2FJw5qqT5VI8aXAGEOABFiXoEefc24DeC2AVV7ab6qpvN0wPSlBImOtmeyoucd6ir46ORn6ckfaDHhJPC6SqZRFgA9MdGVxe6A1QNKCNYEmiCF0JiKCsbAWMCCSPdqCBN20f9mrZpDnHawHRl50kk4Q4IEYh8MGo2I6RiCwhhPQbKiuVtUNDbqZ4QAgCHP25j6G2FEEAh+OKFN5OCJzbpdPfpl7Cti5XT4BQERGi8H2yYqIqmzNBHvnbko/wfG4QtjYxJzNuiKi1oxhAJheZoonAGgbbx5aXXBLEc1gZkhwy59LUMohEjltEZVixeRiZ8VwfxcYi+O+OXbE1w9l2P7zvM27DhXam56hcPX3JTlO8MKJQB1yCFM0cyAIjiR6NQD2xugDSbTFiZGig0K82jCbLm0DMERgA2kMfg8AGCgvlMFSEDna3FKxeecfB3pH04rYv5Yr+ekTgUaXthyRWNW2vPJLU6/eud1Lj4f7F9AlkTbR6x90Bc3NGgaDIYheTQCvHSKvdcgSvHRMAWlzsBdl/dwcIEb3xan9hQobbDmHTLcq36yGPO9/9tdU/csUV372eKB1u69NuSNvaa6r+gV53iNcXy+an/nv4QNPKmX4A3OLmo/yBzPWgpmEFKAypRTjzKbhZ3sKKRLaMnqMZW2tmeSqshOcez+Ae/oAexT+PkvYA2YG2RiQz6dMDdN9NcTYUlrKBHAT5W9rAJkhHspTWkqzU8/0JZ9CTwJyTbVVX9TM31eC/vHIDZc9tHpd6tDqJWdVBiwAWG2bMkxdUSXLs8JeAqCtcGPAeMVHKAm784bLyqzGwh5tYSHCtKI/Ax+qBtiVhHbfbm82ud8SSNkB+mwwIAQ4S6DDrhCNIDxdCCauzbfuPKsFW3hAPSCmrnuhq7m2Kl0kxdJubThrWDGwtPX6y0umed6YrqDwKlK8CuAm5pUESAazI4TKGtvuSH0yL3SQBGALjoR9GiGXpE4yQeHvTcL5emeg75BEpZZZlyjlnGD+BCXxvtCUHX31SyElZI73dKapJvacK8ScnAUyhmGBNx6Ox0orvHTPYDQaqpSRE1WGvLRpqcWcfDyKBQGWQk3i3PVFPX2zPMuJhMSkvZ9rbs7Wljjy1T3aBIFlIZj/Y3/t4ieRTHagtmpYLrLCJXdNx0pry5WY1xkYo4SQ2nJ3R6AfG+ZppbyveoYrxOt8A2SNBYNu2b18/tcu3ZzyR82flp7NGEuWUd363stLKPlcz3iZwifxzZaEiht3DKkFlx6VHPr3BmzZyPUQjWl+yPboT8+MuotaM/x/ksBdq9Nn8nmhu9nqR3cdvq22qvECR17dkguuBfAU2uKE4UiPYWlNEOzBHgzU5UWOmN4RmG6G2g4Aqz2PV5/irw7PuRribqdhsYagQt/9IRtMO1KACY8Pt8H0qeczf4nmIAJInW6SWcZmRfRmAJQz1pQ7akYnzNsI+MFor6DgeggkYZtqKy91iN7SFYZpEZXE2uJ3M9fvPlrofD2YGVXoNrW24rRrXVPQnEjIOZ7Xsr+m6sELHPnRE4GmjsBwhOgd+1dW3gPPS48VkBJ55mPQZkG00jKEH9JoWk+JuXksNOoDsnqIA8/gKt8ymEGKiInRCBSSo1PnHFBD09/DqjUIXqqJfUhbfloRqWxo+s8+njNfJeCDzTy8Dv0Fjc9a/A1LgIh0mRLyhK9/MGvD8NwghXHixismZrTepwTKe4015Y68VNrocgIeHqkrYmthXo5+6lgOXeWOmt3TYV/PwC9Hc8fRWd9x0jM3D8xgI46c4ms824g6XLjpZyBQ53RCLPI8v7mu6p8zxj4kBX1k38rLvw3P23e2qzm2xuMymUrp24AUE15nLd/MwJdXj+MtCFvb4rQUKW4SfNNkV3JTr9k2Z+P2lrxwsqsLZ3t6g0FzLEMEWDZjbopkA7jCATQ4q6XRQ/P3MBtMA6deDz4MfhD9AhI2NPuV1xGYLFFYoxqwZUH4f7uXz48cKXStGeFoaA3LQC2L1cVKRq1lG14vQgSI7+c3fGwBwZjHDJAr5Ve6ApMRIMlgU6ykQ1p8igAulDyOnmPC9AhW7i86AtPtCBH282RmS3z3jkTMXTJKGhV6wh78Q9U1UUlVmbB1ojQMAtH/nG/zaJUHsyUeVxdvTD+b1fbz5Y6UBKDdN6bMFX99YEXlTSA6pmhI37mkJGxTbdUVEYF4l7YMwOnRlqWlBziRkJyIuZxIyC3xuBrow4mE3L18fmTSw9vbDeNnpUqSINIEwBrzkZAHYiPSdpL5vOe56144CMKvJziCjbW3EsDeONFxSb6O3bJ97QlfQxLSBX4dk9DLd3Gaub7RO+7rp6dFnDJh9Kfz/U/P2JUjeXeUgPCOZAMTleLqA7WV1yYBO9x+xIPH9yC2plL2xI1XTCTQe3KWSQjxkwKY99eUKQkLoqMRKSCsmAGAMJoS2HxuuHQwLRq26DwWnMgMI782bDDdkskY8rzBP6mUJs8b9vXcop9WEpb6Pbx9HzOvLVeSGEBGW1vuyAURGfnSKs8zDdXVagSAQTsSMfeqNQ3B/hWV7yhT4t1dvjYEQlRJ0RmYF2ba7MMM0NKx5BPmzWkvkRDTH3nuJc384/KwVBGdgWFH4N0tdYsWFjTAUb+DwJxIyLnr/niQmX9YpgQxgF5tuNxRlRN68XnyPIN4XI4EVDnPUASwtVjtCiIGWyWE7AxMt9YmVTic5xNUC1H/2W3Re07k9DOlSiom5sAyiMS9zJiXswyigTXVQu9PYtxaqqQkwC9RQuTYPjVjc+MziHlMXtonzzNLUyk90Ic8zzxbtqeQO/mdjLHMYKdLW3YEXbf/rZVVlEyOfH/zh5KZv90eGCoicdPBuqrXhL7ksTWGKTSWaVqxeFG5I6u6tUk/WRLb3S8FbmwjnSACrGT6fJe2cIg+cHhlbP7Z+HyVB8P1EDM2PN/gW/7VJFcKWEr29yWPZaysrpZJwHb6wSenuGr60WzQEkj5EE5rqrT1ZHn2HkHEFngVAB6Vj7UtHpbyWrq8VAkw8NLFqf3Z+vox9h0ZwziF6Im8lielWt2jTY8rwntjO3xjJihxZ0tt1WcKteWFbvRn81tw/soIrgct8tJ+04rKFcVKPpCz1jIRgZgdIgLw97R5Ty5fKz5mAvTNH/TlHm19EUaRTZkjXWP5E+OipXrhO0jTF7oC2+UKQQRCp69NiZSfal4R+wTlu7sPRqOCVOd8H1hKpXRzbeyzZUos6wzCC1XyTV02XPTorlZOQJ5vJiGAEfOYGhoCtuJW33JOgkTOsFWCpitBF+UK1QcDBSk8zxxIxCYz8K7usAJYSCIIxn0n3RjD15oZoJkbG5/KGLutRErBjKBUSSUl3TrS54WaHgwD4v6N6ce6AvurSa50jcU3OR5XiNXzWBqwhKWKYAvz8YmuElKK+1Z5ntk6Tq0H86XTYuZrGzd2BObJC6NOcc7QZwbi80K1Hwmx+ljO2AmuXHqgpupvluabnI/ahxmPq6saGoL9KxZdVSTpkwYMItxz8cPb2znfNvBMf6Z9wjeWALyVl8+PFCzMEb24oiJ0jTDqwh/S7wBg9cvYN0CcETTJa3m+4bvKHCmJ2DBB9GhripX44qHaRd98cdm8CXTyqgTm+rBDfUEiE8CFjv4tNbE7I1L+wjCigQUxs5nkKtXumx/P3tj4s/Espwy1VIgZGxt3Btb+LN9QAx2BYVfgvQXpvRaj1zwIIY1mPdbY5Ft8plQJEdKIRMZYW+LKrxyqq/rG/trFk06nEcfjiuNxVaBTEuHNBn9aPt89WBf7YomU/9SjrSEK7ybJGMtSiS+/nJHRQmnd7M07nstaW1/uSAFiq5lZ8xBO1DxwiB5650RXXhBYGzhCOJ2+Ppzzsz8fjdZdaEwtiR5wBIHBoifMP373/trFk5aMplVcfb78mszHj+V07yRXvral5Oi9+ZxTHo2muiMRc69qaAj2Ll/4lsmu/OvWHv9AtCjzwFjaYJ5di0jktV3+fIdvEBH03taVlVUhn59qyq/yYNYmEnLW+h1P5Yz9ZpEkRAS+vG9F7M2FRvAjpd226mqHUim9f9llM5TgH090VfR4TqdmFFd9i+vrxem3cRTWLm3k0basPjbZlfMPCPddlIRtTMScEb3X80xLXezaYkXxtmxgAPws/xL7ZwGofVIvkZBzNqX/43jOPHCB6zjErC0gugNrix3x0eKi4oZDdYv/7vDK2PyC+bLKgynkeba9deH0pprK97bWLfptqaP+PWB2fctMYD3RVU6Hb/5Q7OgPMyCGe/3J8AONec1I8b/2amsFSFiwKVUymjP4BAGcSIztCgrKm4NzN+349nHf3HeB6zgUNpSh7sDaEiU/5pL94+GVi+9qvmHxZfUIg2GUSmlKpXSBTq1vveyiltrYbWUq8vtSpT7To61lQIJZT3alzFm+b8a6HdtCoYOX7bKzguk/56r0l9p982SZlArMdsh+BKmU2RKPKwu+3bcMgLhYCgD48SW/3NtR6JY/Mjd2eFiIAq8zMMddKVTOWD3RVRUK5u0E8Eg1QEqG7q45G3btyDF/NAhzsG9rrqta01BdrciD4QQkJxIDunIK3ae2xOOqHhCLvLS/r27xq8sc9X1JJHyYv5ns7R17G8wBfKlzNqY3d2qzdWqRigaGPhv6Us9yPjzPrk1Amt6eu45k9RMTXBUtksJrXl618qr8dS+n3xd3NstqSzyumEFXNTQEL9UtWuhE1KYLImr+0Zw+KATeHypJSZztiiROJOSMzc8eAfG3HEFwhfiXF1csXLDIS/vbqqudgd7d1+ErX1f/4rLqCcx070RHqazlX8ze0Lid6+vPTybMcAE1b9ZarofY0zPl9hOB/tHkiONQXlHv8LWRhEtKFH3VWHq+uabq+aba2LrmmqqfNdVW/aK5JvZ7X4md5Y76QUTQ6zsDbSyzIbCdHFFOT2D+kGOuLVw9Pd5mLHkwSEDMWrfzj76xj5Sp8AR3BoZdQe9vXXn5xWP1pYY0gl2bgJy98e13HPODH0x2VR+N2n1tJNHcYkn3kDHP31Zb9XxTTWxdU23VA001Vd9tqqn6eXNN7Fmr5I4yR61xhLi8w9eGCWSZg0muctp988dIN3/ybFL+vGupBdM/CUuCbstazkoi4kH2jhMJSQBfWtYWL1Hyil5tLQhOj7aWib4HjK5JdCGIks8M+e8SKSCITGAZhnEH159aWz18d0JYejt3Y/p7XYH9TGAZkx1528zp2V8dqlt4TeHyvUJgZW0BYBMJyXmfHSVhCz0pWmpjtxWDfz3JldMO5YJ/uGjjrg08DpV6gwZnSH7+uK85IultLXULX322CwEJ4EYPfHFqf1YI/bZjvv79JFdOlhI/P1gT+/zxZdUT+t8Xx/UQ/ddZ2IOlqZQmArfWLfpglDk1JaIuP+Hrg76xdTPXpw8UgpGD4Uu3NP96KKsbJ7tyWpGQG1pWVL3hqoaGoP+7C5ZvfxpTQ0Nw4C2x+dFIdv0Frlrclg2OusZ8igHKd4x52YYa6ABxEliClCHgvS21VXscon+MKCG7AmtzxgY5YyGIiqJKVDmEqkKSoGFGzjI6tdFgsgBkVEnpEtAV2Ic6Te7DCzbv6RxeChNZDuvlLY8CdoUUX8xau1IAMIyg1JElnYG5k4BPcDohzpKX2v99drAafQKYPVggiVkb8P6W2qq9StA/FokzaOQUSRFzCDGZ79VkGQiYkbMWHYHW6OeFnBJxnC6t/2AVbpqRSnfXp5Ji4M5DxP3nK/qSxwcc4bqYhlzf2bS4vHtm176aqs9OceWXTvg6YJCk/D71B1iv74Xiw4pgCciVSBHpDMyTczeltzNGn8JWqPwRhO/0GnsrM6seY3RUiisPbKt8w1zsfOJs99EPNZamUjq/xi8dqIk1G6Z/uzDivPFQDr89WLtoLQn+YU9W/p4ef64tTIb3TvEjNpe2XWwhlknGX19Y5Ly2PTA4mNGfuWTTzi/l5zN4HnJYaWxHo0SEmlnyl/trYr+eFXWva8ni/wJYlYjVM5A8QyjV10PMTO4+uvP1ly2jyfjPUke+KyLo749S5h1NtYvuZ+hHZndfuCu8l/7Uc9JSF5sjWCwz4A+WKnGtKwjtOf1URusPznv0hReGon1BKFWue6Hr8MrYTcd9s7miSM0/mtW/bqmt+i4TPehE7fOUTHefbuZXTAsuE6zfJgV9bEpETT3um+MB8c1zH31h35CYQmCMkO/HBVD7LzokfOPqlhVVjwO0ukjSsiIpRdZY5CwjY4zO9qv+YLAASLlCqKgQYDByxj7XZfmemRvTP86r7kMeJjKWIKk4qoTQBsKVhKxhMXwGg6DkjqcO1MZ+fWHEWXYi0NCWIQl3HlgZu5c8b08+P7Y/cYujioQJuCiqBE4EcIbS3ApmCCUbV+9bUfU4CU5GFV0XESGNfMvInqQR99taAiAFkXIFoUgK9GpjurT+zp+O6U9f+7sXuoZiEGI4USVEtzZFUSXQmzPRAb+rLUGE68tadqNKoFvrkeUAFhL+Pe8rzbWxlVOKnDd1BgZA+LwTvnUAYEnFEUFeym++4bLLpKWEZkAJikaVQK8xa/K+UIFR5kCu8mCYQUSN2w7Uxp6ZGnGuPuFrTHAksjn+JIAnvHx3sNG5cxKSPO/H+2sX/0+br+sl8K6KqHpHzvA7tKs7m2urdoLRBOKOUKBgWgsfuYggFs6JOggs40hO/87X9q65m9NP5vdxcHAXVkSVIzoCXTw6LTWdT5SXyY7AXDdBiURLbeUbKZl8onBN9imgmr/xgH73QheAdx+sq9qUAd19QcSpjAj6wqEsvtBSemRnc03VS0w4DAYDPBlEF1lG5bQiFSEAbbngSJelb3bb3BcXPLont3aYgqxw4wI9kt7TtHzxkuOkv1GkxE0THXnHcd/c0dtDB5prYy+C6RgTWwImApnZgqhyetRFr7E4ljO/7WX+6LwN6e1rz9YM5ozzQg6UEGzhnndA7TP1kqFTnrzG3wK4vrWmammvte9mwpsImBeVUrmC+p6jmdGrLVvmlowxvzWQaw+2Fq27qqEhKADYcHqrqgh8bei5jLZRC1ijSWjI3jCaP7SE8dJhd/SD4H/q0XZWYJl9tjzBEW67b24A8NV8LTcDgF/mclEP0r3adhmG361NRICHTMI+C42WHaxbFDds3slMcWZcUqSEGxHiDFqHXaVMoJn29ATmcQvx4Iz1zzcMJXSWnLw76HCPNrsNs9+rjQvQnwaaZyCjmtjuyGg7SQO6VxuHWJwYan1nCJBYLCylBN/aHZi1geUiBptubVxBIb3+lK83R+AsLXJpT3dgskqQeyQbHClSZt1oglFnompCAJ4B6N9yxiYtIziW0xLAnIPLr5w6w/OOjLbaqR+o7gXwgcO1VV9tzQTvJML1YFw5KSKvLpbi6rA7LMNaoDMwyBp7+HA2+I1m/uGsDelHCgGtQQ96gZc19/Ros5sIrTitfn8kvlRKPv/E/trKNdMi7ps7A7EKwBMJ7+z5uX2FNPUgSjb+oKWu+qftudzNDH47M64tcWRluZKVfa3RmNGtLToCkzmcC54QoF/khH5o7voXDgJ9lXzDv+0XYR4wJZ9vBnDzoZWLrm/LBh80jHixEnMmOHKOpD7/KboDiy5tOg5ngyeZ8cNvX9W4NpkMXW+DulLy/E3AoSAwL1Khv8A5KIcdfq7kSTAMD3Mi5h7NyYuzRl8imCYw0UTB1GXJdjqg/ULqvQU/aZ9PbQTRfAaoobo6BKHq8N+q1zTo0RyQ/6yudm6vBhoawr9fUHpUFmrjT0//aLism9AAFM3LUFUsrUdilp5Oo23V1c6saf5sDT0PJC6wBmVScBEzWcvczpKOFhHvreicuq9wJ/rpzxjqfZ4XU/OiUd47L0NT26bawfrK9l/f3nkZavTSOjm2xuFiRyKmsnujfDZ67V4+P/JsmcvzCv/vpc/JdS5rYzF33rVRRgNQPS9DW4egwwiC/2J1/aklw3trKucqKy8ixVOExUQiBNrazqhQTTLn7pn8y4aO/vszXP5hgBoTMaeqbaqlMcy9IETWxmLua6b2iLPx+YA+737ns7128aRey5cwmZmWxATBcCyjXQjbFmjec9Gju1r7/xaeZ0e7t4UAVOH3R5fPL7dKzQ+sM9uSncAWriIcZ8ZhUST/NP3nz7WNisb1EJv+Z77TXbZHr3oZg7ynET50xg93kwaLjJ6X+b4M7147AhoVxpaTOat/EWO0dD0XN9ue87Xmo/cj2fu/xFs++y6JHAYf9uWaj+M6Q7wYOkWtL1D2Z0hjGhMj14OQTlD/SoslFRWMmMfD1bJGcljGKgGHes54vW8oGo0nrfrPuZ91hPO2viGeN5L5vdx8MpzzUg/Q6gRo62kXSi5ZkrJj5fnTNbXxoMmY+KoedHqhxJKKFMODPZdFJgO9+0hFihNjfPd49399ZbwyXhmvjFfGORr/HxAu9kAIUFdPAAAAAElFTkSuQmCC";
const DEFAULT_MINILOGO = "data:image/png;base64,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";

/* ============================== ESTILO ============================== */
const CSS = `
:root{
  --paper:#E7E6E3;--surface:#FFFFFF;--ink:#2E2F2F;--ink2:#55565A;--muted:#8C8C88;--line:#D8D7D3;--line2:#BEBDB8;
  --accent:#E34B2A;--accent-ink:#C23D1F;--accent-soft:#FBE7DE;--brand:#E34B2A;
  --platino:#E4E3E0;
  --good:#2E7D4F;--good-soft:#E7F3EC;--warn:#B26B00;--warn-soft:#FBF3E4;--bad:#C0392B;--track:#E4E3E0;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;--sans:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
}
*{box-sizing:border-box}
.app{font-family:var(--sans);color:var(--ink);background:var(--paper);min-height:100%;-webkit-font-smoothing:antialiased;padding:14px;max-width:1180px;margin:0 auto}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:600}
.titleblock{background:var(--surface);border:1.5px solid var(--ink);border-radius:4px;overflow:hidden}
.tb-top{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1.5px solid var(--ink);background:var(--ink);color:#fff}
.tb-top h1{font-size:15px;font-weight:700;letter-spacing:.02em;margin:0;line-height:1.1}
.tb-top .sub{font-size:10.5px;color:#AEB8CA;letter-spacing:.14em;text-transform:uppercase}
.logo-box{background:#fff;border-radius:5px;padding:8px 11px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;min-width:96px}
.logo-img{height:26px;width:auto;max-width:190px;object-fit:contain;display:block}
.logo-hint{position:absolute;bottom:2px;right:4px;font-size:7px;color:#C2C8D2;font-weight:700;letter-spacing:.05em}
.tb-grid{display:grid;grid-template-columns:repeat(2,1fr)}
.tb-cell{padding:8px 12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.tb-cell:nth-child(2n){border-right:none}
.tb-cell label{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:2px}
.tb-cell input,.tb-cell select{border:none;outline:none;width:100%;font-size:13px;color:var(--ink);background:transparent;font-weight:600}
.tb-cell input::placeholder{color:#C2C8D2;font-weight:500}
@media(min-width:680px){.tb-grid{grid-template-columns:repeat(4,1fr)}.tb-cell:nth-child(2n){border-right:1px solid var(--line)}.tb-cell:nth-child(4n){border-right:none}}
.toolbar{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}
.btn{display:inline-flex;align-items:center;gap:6px;font-family:var(--sans);font-size:12.5px;font-weight:600;border:1px solid var(--line2);background:var(--surface);color:var(--ink2);padding:8px 11px;border-radius:5px;cursor:pointer;transition:.13s;line-height:1}
.btn:hover{border-color:var(--ink);color:var(--ink)}
.btn:active{transform:translateY(1px)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{background:var(--accent-ink);border-color:var(--accent-ink);color:#fff}
.btn.ghost{background:transparent;border-color:transparent;color:var(--ink2)}
.btn.ghost:hover{background:#fff;border-color:var(--line)}
.btn.sm{font-size:11.5px;padding:6px 9px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:6px;margin-bottom:11px;overflow:hidden}
.sec-head{display:flex;align-items:center;gap:9px;padding:11px 13px;background:#F4F6F8;border-bottom:1px solid var(--line);cursor:pointer}
.grp-toggle{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;flex-shrink:0}
.grp-toggle button{border:none;background:#fff;color:#9AA4B2;font-size:11px;font-weight:800;padding:3px 9px;cursor:pointer}
.grp-toggle button.a.on{background:var(--accent);color:#fff}
.grp-toggle button.b.on{background:#2E2F2F;color:#fff}
.grp-toggle button.c.on{background:#8A6D3B;color:#fff}
.sec-no{font-family:var(--mono);font-size:12px;font-weight:700;color:#fff;background:var(--ink);padding:3px 7px;border-radius:3px}
.sec-name{border:none;background:transparent;font-size:14px;font-weight:700;color:var(--ink);outline:none;flex:1;min-width:0}
.sec-sub{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent-ink);white-space:nowrap}
.psub{padding:11px 13px;border-bottom:1px solid var(--line)}.psub:last-child{border-bottom:none}
.psub-t{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:9px}
.optrow{display:flex;align-items:center;gap:9px;margin-bottom:8px;flex-wrap:wrap}
.optrow .ol{font-size:11.5px;font-weight:600;color:var(--ink2);width:120px;flex-shrink:0}
.optbox{display:flex;align-items:center;border:1px solid var(--line);border-radius:5px;overflow:hidden}
.optbox input{border:none;outline:none;width:52px;text-align:center;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent-ink);padding:6px 2px;border-right:1px solid var(--line)}
.optbox input:last-child{border-right:none}
.defrow{display:flex;gap:16px;flex-wrap:wrap;margin-top:2px}
.defrow label{font-size:11px;color:var(--muted);font-weight:600;display:flex;align-items:center;gap:6px}
.psel{font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--accent-ink);border:1px solid var(--line);border-radius:4px;padding:5px 7px;background:#fff}
.params{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line)}
@media(min-width:560px){.params{grid-template-columns:repeat(3,1fr)}}
.pcell{background:var(--surface);padding:9px 11px}
.pcell label{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600;display:block;margin-bottom:3px}
.pwrap{display:flex;align-items:baseline;gap:3px}
.pcell input{border:none;outline:none;width:100%;font-family:var(--mono);font-size:15px;font-weight:700;color:var(--accent-ink);background:transparent}
.psuf{font-family:var(--mono);font-size:12px;color:var(--muted);font-weight:600}
.item{padding:12px 13px;border-bottom:1px solid #EEF0F3}.item:last-child{border-bottom:none}
.item-ops{display:flex;align-items:center;gap:2px;margin-bottom:7px}
.item-no{font-family:var(--mono);font-size:12px;color:var(--accent-ink);font-weight:700;background:var(--accent-soft);padding:2px 7px;border-radius:3px}
.fld{border:1px solid var(--line);border-radius:4px;padding:7px 9px;font-size:13px;font-family:var(--sans);color:var(--ink);outline:none;width:100%;background:#fff;transition:.12s}
.fld:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
textarea.fld{resize:none;line-height:1.3;font-weight:500}
.grid3{display:grid;grid-template-columns:1.1fr 1fr 1.2fr;gap:7px;margin-top:8px}
.lbl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:3px;display:block}
.num{font-family:var(--mono);text-align:right;font-variant-numeric:tabular-nums}
.rates{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;align-items:center}
.rate-grp{display:flex;align-items:center;gap:7px}
.rate-grp .rl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:5px;overflow:hidden}
.seg button{border:none;background:#fff;font-family:var(--mono);font-size:11.5px;font-weight:700;color:var(--muted);padding:5px 9px;cursor:pointer;border-right:1px solid var(--line);transition:.1s}
.seg button:last-child{border-right:none}
.seg button.on{background:var(--accent);color:#fff}
.item-out{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:8px 10px;background:#F7F9FA;border:1px solid var(--line);border-radius:4px}
.out-pu{font-family:var(--mono);font-size:12px;color:var(--ink2)}
.out-total{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--ink)}
.breakdown{margin-top:8px;border-top:1px dashed var(--line);padding-top:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:5px 16px}
.bd-row{display:flex;justify-content:space-between;font-size:11.5px}
.bd-row span:first-child{color:var(--muted)}.bd-row span:last-child{font-family:var(--mono);color:var(--ink2);font-weight:600}
.linkrow{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
.linkbtn{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--accent-ink);background:none;border:none;cursor:pointer;font-weight:600;padding:4px 0}
.linkbtn.has{color:var(--accent);font-weight:700}
.iconbtn{border:none;background:none;cursor:pointer;color:var(--muted);padding:6px;border-radius:4px;display:inline-flex}
.iconbtn:hover{color:var(--bad);background:#FBECEA}
.iconbtn.mv:hover{color:var(--accent-ink);background:var(--accent-soft)}
.iconbtn:disabled{opacity:.3;cursor:default}
.contractor{margin-top:9px;border:1px solid var(--line);border-radius:5px;padding:11px;background:#FBFCFD}
.contractor-h{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:var(--ink2);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;flex-wrap:wrap}
.cgrid{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:520px){.cgrid{grid-template-columns:1fr 1fr}}
.priv{font-size:9px;font-weight:700;color:var(--warn);border:1px solid #E7CC9A;background:var(--warn-soft);border-radius:3px;padding:1px 5px;letter-spacing:.04em}
.summary{background:var(--ink);color:#fff;border-radius:6px;padding:16px;margin-bottom:11px}
.sum-hero .big{font-family:var(--mono);font-size:30px;font-weight:700;letter-spacing:-.01em;line-height:1}
.sum-hero .usd{font-family:var(--mono);font-size:12.5px;color:#AEB8CA;margin-top:5px}
.sum-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#3A3B3B;border:1px solid #3A3B3B;border-radius:5px;overflow:hidden;margin-top:14px}
@media(min-width:560px){.sum-grid{grid-template-columns:repeat(4,1fr)}}
.scell{background:var(--ink);padding:10px 11px}
.scell .k{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#8E9AB3;font-weight:600;margin-bottom:3px}
.scell .v{font-family:var(--mono);font-size:14px;font-weight:700}
.scell-sub{font-family:var(--mono);font-size:10.5px;color:#B7B8B8;margin-top:2px}
.gauge{margin-top:14px;background:#3A3B3B;border-radius:5px;padding:13px 14px}
.grpsplit{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}
.grpsplit .gs{background:#3A3B3B;border-radius:5px;padding:11px 12px}
.grplabels{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#F4F6F8;border:1px solid var(--line);border-radius:6px;padding:9px 12px;margin-bottom:12px}
.grplabels .gl-t{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.grplabels .gl{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--ink)}
.grplabels .gl i{width:10px;height:10px;border-radius:2px;display:inline-block}
.grplabels .gl.a i{background:var(--accent)}.grplabels .gl.b i{background:#2E2F2F}.grplabels .gl.c i{background:#8A6D3B}
.panelC{border-left:3px solid #8A6D3B}
.cinfo-note{font-size:11px;color:#8A6D3B;background:#F7F1E8;border-bottom:1px solid var(--line);padding:8px 13px;line-height:1.5}
.crow{display:flex;align-items:center;gap:8px;padding:8px 13px;border-bottom:1px solid var(--line)}
.csum-bar{display:flex;justify-content:space-between;align-items:center;background:#F7F1E8;border:1px solid #E6DAC4;border-radius:6px;padding:10px 13px;margin-top:11px}
.csum-bar .cs-lb{display:block;font-weight:700;font-size:12.5px;color:#8A6D3B}
.csum-bar .cs-note{display:block;font-size:10.5px;color:#A9926B}
.csum-bar .cs-vl{font-family:var(--mono);font-weight:700;font-size:14px;color:#8A6D3B}
.cinv-bar{display:flex;justify-content:space-between;align-items:center;background:var(--ink);color:#fff;border-radius:6px;padding:11px 14px;margin-top:8px;font-size:12.5px;font-weight:700}
.cinv-bar b{font-family:var(--mono);font-size:15px}
.grplabels .gl input{border:1px solid var(--line);border-radius:5px;padding:3px 7px;font-size:12px;width:110px;font-family:inherit}
.grplabels .gl-hint{font-size:11px;color:var(--muted)}
.grpsplit .gs .lb{display:flex;align-items:center;gap:6px;font-size:11px;color:#B7C1D2;font-weight:600;margin-bottom:4px}
.grpsplit .gs .lb i{width:9px;height:9px;border-radius:2px;display:inline-block}
.grpsplit .gs.a .lb i{background:var(--accent)}
.grpsplit .gs.b .lb i{background:#BEBDB8}
.grpsplit .gs .vl{font-family:var(--mono);font-weight:700;font-size:15px}
.gauge-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
.gauge-h .t{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8E9AB3;font-weight:600}
.gauge-row{margin-bottom:9px}.gauge-row:last-child{margin-bottom:0}
.gauge-lab{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px}
.gauge-lab .name{color:#C7CFDC}.gauge-lab .pct{font-family:var(--mono);font-weight:700}
.bar{height:7px;background:var(--track);border-radius:4px;overflow:hidden}.bar > i{display:block;height:100%;border-radius:4px}
.client{background:#fff;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.ctable{width:100%;border-collapse:collapse;font-size:12.5px}
.ctable th{background:#F1EFE8;color:#55565A;font-size:10px;letter-spacing:.05em;text-transform:uppercase;padding:9px 9px;text-align:left;font-weight:700;border-bottom:1px solid var(--line)}
.ctable td{padding:7px 9px;border-bottom:1px solid #EEF0F3;vertical-align:top}
.ctable tr.csec td{background:#F4F6F8;font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.ctable tr.csec td.r{letter-spacing:0;font-size:11.5px;font-weight:800;text-transform:none}
.ctable tr.csub td{background:#FAFBFC;font-weight:700}
.ctable tr.cgrand td{background:var(--ink);color:#fff;font-weight:700;font-size:14px}
.ctable tr.cgroup td{background:var(--platino);color:var(--ink);font-weight:800;font-size:12.5px;letter-spacing:.03em;padding:11px 10px;border-top:1px solid var(--line2)}
.ctable tr.cgroup td.r{font-family:var(--mono);font-size:13px}
.ctable tr.cgroup.a td:first-child{border-left:4px solid var(--accent)}
.ctable tr.cgroup.b td:first-child{border-left:4px solid var(--ink)}
.ctable tr.cgroup.c td{background:#F7F1E8;color:#8A6D3B}
.ctable tr.cgroup.c td:first-child{border-left:4px solid #8A6D3B}
.grpsummary .gsr.terceros{background:#F7F1E8}
.grpsummary .gsr.terceros span,.grpsummary .gsr.terceros b{color:#8A6D3B}
.grpnote{margin-top:14px;padding:12px 14px;border:1px solid var(--line);border-radius:6px;background:#FAFBFC;font-size:12px;line-height:1.55;color:var(--ink2)}
.grpnote div{margin-bottom:6px}.grpnote div:last-child{margin-bottom:0}
.grpnote i.dot{width:9px;height:9px;border-radius:2px;display:inline-block;margin-right:6px;vertical-align:middle}
.ac-wrap{position:relative}
.ac-list{position:absolute;left:0;right:0;top:100%;z-index:40;background:#fff;border:1px solid var(--line2);border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.14);margin-top:4px;overflow:hidden;max-height:250px;overflow-y:auto}
.ac-head{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:7px 11px;background:var(--platino);border-bottom:1px solid var(--line)}
.ac-item{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:#fff;border:none;border-bottom:1px solid var(--line);padding:8px 11px;cursor:pointer}
.ac-item:last-child{border-bottom:none}
.ac-item:hover{background:var(--accent-soft)}
.ac-item .ac-d{font-size:12.5px;font-weight:600;color:var(--ink);line-height:1.3}
.ac-item .ac-m{font-size:10.5px;color:var(--muted);font-family:var(--mono)}
.grpsummary{margin-top:16px;border:1px solid var(--line2);border-radius:7px;overflow:hidden;max-width:420px;margin-left:auto}
.incid-info{margin-top:9px;font-size:11.5px;line-height:1.5;color:var(--ink2);background:var(--accent-soft);border:1px solid #F0C9BC;border-radius:6px;padding:8px 11px}
.incid-empty{font-size:12px;color:var(--muted);padding:4px 0 8px}
.incid-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:7px}
.incid-row .num{text-align:right}
.incid-amt{min-width:96px;text-align:right;font-weight:700;font-size:12.5px;color:var(--ink)}
.incid-mk{display:flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;color:var(--muted)}
.pf-toggle{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 4px}
.pf-btn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line2);background:#fff;color:var(--ink2);border-radius:20px;padding:4px 11px;font-size:11.5px;font-weight:700;cursor:pointer}
.pf-btn.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.pf-btn.on2{background:var(--ink);color:#fff;border-color:var(--ink)}
.freerate{display:flex;flex-direction:column;gap:3px;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}
.freerate input{width:88px;text-align:right}
.pf-hint{font-size:11px;color:var(--muted);font-family:var(--mono)}
.prod-btn{border:1.5px solid var(--line2);background:#fff;color:var(--ink2);border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer}
.prod-btn.on{color:#fff}
.dseg{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line)}
.dseg-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.dseg-f{display:flex;flex-direction:column;gap:2px;font-size:10px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}
.dseg-note{font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.5}
.incid-mk select{border:1px solid var(--line);border-radius:5px;padding:4px 5px;font-size:11.5px;font-family:inherit;background:#fff}
.tc-info{font-size:11.5px;font-weight:700;font-family:var(--mono)}
.tc-info.ok{color:var(--good)}.tc-info.err{color:var(--bad)}
.tc-note{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5}
.ab-toggle{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:12px;cursor:pointer;color:var(--ink2)}
.ab-sw{width:36px;height:20px;border-radius:20px;background:var(--line2);position:relative;flex-shrink:0;transition:background .15s}
.ab-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}
.ab-sw.on{background:var(--good)}.ab-sw.on::after{left:18px}
.avbar{height:9px;background:var(--platino);border-radius:6px;overflow:hidden}
.avbar-f{height:100%;border-radius:6px;transition:width .2s}
.avrow{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line)}
.avdot{width:9px;height:9px;border-radius:3px;flex-shrink:0}
.fotogrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fotocard{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
.fotocard img{width:100%;height:150px;object-fit:cover;display:block}
.fotocard .fld{border:none;border-top:1px solid var(--line);border-radius:0}
.fotocard .iconbtn{position:absolute}
.fotocard .fcap{padding:6px 9px;font-size:11px;color:var(--ink2)}
.report .rep-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.report .rep-meta>div{background:#fff;padding:8px 10px}
.report .rep-meta span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}
.report .rep-meta b{font-size:12px;color:var(--ink)}
.rep-hero{display:flex;gap:18px;align-items:center;padding:16px;border:1px solid var(--line);border-top:none;background:#FAFAF8}
.rep-global{text-align:center;min-width:120px}
.rg-num{font-family:var(--mono);font-size:38px;font-weight:800;color:var(--accent-ink);line-height:1}
.rg-lb{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-top:4px}
.rep-gline{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;margin-bottom:4px}
.rep-gline b{font-family:var(--mono)}
.estchip{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px}
.est-ok{background:#2E7D4F;color:#fff}.est-go{background:var(--accent);color:#fff}.est-no{background:var(--platino);color:var(--muted)}
.rep-fotos,.rep-notes{padding:14px 2px}
.rep-plazo{border:1px solid var(--line);border-top:none;padding:14px 16px;background:#fff}
.rp-row{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px}
.rp-row b{font-family:var(--mono)}
.rp-status{margin-top:10px;font-size:12px;padding:7px 11px;border-radius:6px;font-weight:600}
.rp-ok{background:#EAF4EE;color:#2E7D4F}.rp-go{background:#FBF4E9;color:#8A6D3B}.rp-bad{background:#FBECEC;color:var(--bad)}
.rep-h{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ink);margin-bottom:9px;border-bottom:2px solid var(--accent);padding-bottom:4px;display:inline-block}
.rep-note-b{margin-bottom:12px;font-size:12.5px;line-height:1.6;color:var(--ink2)}
.rep-firma{text-align:center;margin-top:30px;padding-top:10px}
.rep-firma .rf-line{width:200px;height:1px;background:var(--ink);margin:0 auto 6px}
.rep-firma b{display:block;font-size:13px}
.rep-firma span{display:block;font-size:10.5px;color:var(--muted)}
.rf-nom{margin-bottom:3px;letter-spacing:.01em}
.rf-cargo{font-size:11px !important;color:var(--ink2) !important;margin-bottom:5px}
.rf-emp{font-weight:700;color:var(--ink2) !important;letter-spacing:.02em}
.rf-mail{margin-top:2px}
@media print{
  .no-print,.no-print-controls,.menubar,.toolbar,.toast,.modal,.mb-drop{display:none !important}
  .fotocard .iconbtn,.no-print-controls .iconbtn{display:none !important}
  html,body{background:#fff !important;margin:0 !important;padding:0 !important}
  .app{max-width:none !important;width:auto !important;margin:0 !important;padding:0 !important;background:#fff !important;box-shadow:none !important}
  .client,.report{margin:0 auto !important;box-shadow:none !important}
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  @page{size:letter;margin:16mm 14mm}
}
.kgrid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:12px}
.kcard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}
.kcard.accent{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent-soft)}
.kc-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.kc-t{font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--ink)}
.kc-tag{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);background:var(--platino);padding:2px 7px;border-radius:20px}
.kc-tag.a{background:var(--accent);color:#fff}
.kc-rows>div{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;border-bottom:1px solid var(--line)}
.kc-rows>div:last-child{border-bottom:none}
.kc-rows>div span{color:var(--ink2)}
.kc-rows>div b{font-family:var(--mono);font-weight:700}
.kc-rows .kc-sub{font-size:11.5px}.kc-rows .kc-sub span,.kc-rows .kc-sub b{color:var(--muted)}
@media(max-width:640px){.kgrid{grid-template-columns:1fr}}
.efbar{height:8px;background:var(--platino);border-radius:5px;overflow:hidden;margin:10px 0 6px}
.efbar-fill{height:100%;background:var(--accent);border-radius:5px}
.efnote{font-size:11.5px;line-height:1.5;color:var(--ink2)}
.cf-hd{display:flex;justify-content:space-between;align-items:center;margin:4px 0 8px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.cf-hd .rt{display:flex;gap:6px}
.cf-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:7px}
.cf-row .num{text-align:right}
.empfilters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.empfilters .chip{border:1px solid var(--line2);background:#fff;color:var(--ink2);border-radius:20px;padding:5px 13px;font-size:12px;font-weight:700;cursor:pointer}
.empfilters .chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.emptable td,.emptable th{font-size:12px}
.emprow{cursor:pointer}
.emprow:hover td{background:var(--accent-soft)}
.badge{font-size:10px;font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:20px;white-space:nowrap}
.badge.b-cot{background:var(--platino);color:var(--ink2)}
.badge.b-eje{background:var(--accent);color:#fff}
.badge.b-cer{background:#2E7D4F;color:#fff}
.grpsummary .gsr{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;font-size:13px;border-bottom:1px solid var(--line);background:#fff}
.grpsummary .gsr span{display:flex;align-items:center;font-weight:600;color:var(--ink2)}
.grpsummary .gsr .dot{width:9px;height:9px;border-radius:2px;display:inline-block;margin-right:8px}
.grpsummary .gsr b{font-family:var(--mono);font-weight:700;font-size:13.5px}
.grpsummary .gsr.tot{background:var(--ink);border-bottom:none}
.grpsummary .gsr.sub{background:#F3F1EC}
.grpsummary .gsr.sub span{font-weight:800;color:var(--ink)}
.grpsummary .gsr.sub b{font-size:14.5px}
.grpsummary .gsr.tot span{color:#fff;font-weight:800;letter-spacing:.03em}
.grpsummary .gsr.tot b{color:#fff;font-size:15px}
.grpsummary .gsr.disc b{color:var(--accent-ink)}
.grpsummary .gsr.disc span{color:var(--accent-ink);font-weight:700}
.ctable .r{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
.subtabs{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:7px;padding:3px;margin-bottom:12px;gap:3px}
.subtabs button{border:none;background:none;font-size:12.5px;font-weight:600;color:var(--muted);padding:7px 13px;border-radius:5px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.subtabs button.on{background:var(--ink);color:#fff}
.crep{background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px;margin-bottom:11px}
.crep-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:1.5px solid var(--ink);padding-bottom:10px;margin-bottom:6px}
.crep-name{font-size:15px;font-weight:700;display:flex;align-items:center;gap:7px}
.crep-info{font-size:11px;color:var(--muted);line-height:1.6;margin-top:4px}.crep-info b{color:var(--ink2);font-weight:600}
.crep-total{text-align:right;flex-shrink:0}
.crep-total .k{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
.crep-total .v{font-family:var(--mono);font-size:18px;font-weight:700;color:var(--ink);white-space:nowrap}
.itemtable{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px}
.itemtable td{padding:5px 6px;border-bottom:1px solid #F0F2F4}.itemtable .r{text-align:right;font-family:var(--mono)}
.acctbar{display:flex;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:11px 0}
.acctbar > div{flex:1;background:#fff;padding:8px 8px;text-align:center}
.acctbar .k{font-size:8px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:700}
.acctbar .v{font-family:var(--mono);font-size:12.5px;font-weight:700;margin-top:2px}
.blocklabel{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink2);font-weight:700;margin:14px 0 8px;display:flex;align-items:center;gap:6px;justify-content:space-between}
.blocklabel .rt{display:flex;gap:6px}
.hito{border:1px solid var(--line);border-radius:6px;padding:9px 10px;margin-bottom:7px;background:#fff}
.hito-r1{display:flex;gap:7px;align-items:center}
.hito-nm{flex:1;min-width:0;border:1px solid var(--line);border-radius:4px;padding:6px 8px;font-size:12.5px;font-weight:600;outline:none;color:var(--ink)}
.hito-pct{width:64px;border:1px solid var(--line);border-radius:4px;padding:6px 4px;font-family:var(--mono);font-size:12.5px;font-weight:700;text-align:center;outline:none;color:var(--accent-ink)}
.hito-r2{display:flex;gap:10px;align-items:center;margin-top:9px;flex-wrap:wrap;justify-content:space-between}
.prog{font-family:var(--mono);font-size:12px;color:var(--ink2)}.prog b{color:var(--ink)}
.toggle{font-size:11px;font-weight:700;border-radius:20px;padding:4px 11px;cursor:pointer;border:1px solid;white-space:nowrap}
.toggle.pending{color:var(--warn);border-color:#E7CC9A;background:var(--warn-soft)}
.toggle.paid{color:#fff;border-color:var(--good);background:var(--good)}
.hito-r3{display:flex;gap:8px;align-items:center;margin-top:9px;padding-top:9px;border-top:1px dashed var(--line);flex-wrap:wrap}
.miniinput{border:1px solid var(--line);border-radius:4px;padding:5px 7px;font-size:12px;outline:none;background:#fff}
.miniinput.money{font-family:var(--mono);text-align:right;width:110px}
.ec-block{background:#fff;border:1px solid var(--line);border-radius:6px;margin-bottom:11px;overflow:hidden}
.ec-head{padding:11px 13px;background:var(--ink);color:#fff;font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:8px;justify-content:space-between}
.ec-head .amt{font-family:var(--mono);font-size:13px}
.ectable{width:100%;border-collapse:collapse;font-size:12px}
.ectable th{text-align:left;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:8px 11px;border-bottom:1px solid var(--line);background:#F7F9FA}
.ectable td{padding:8px 11px;border-bottom:1px solid #F0F2F4}
.ectable .r{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
.ectable tr.tot td{background:#F4F6F8;font-weight:700}
.ecgrand{display:flex;justify-content:space-between;align-items:center;background:var(--good-soft);border:1px solid #BFE0CB;border-radius:6px;padding:12px 14px;margin-bottom:11px;flex-wrap:wrap;gap:8px}
.ecgrand .k{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--good);font-weight:700}
.ecgrand .v{font-family:var(--mono);font-size:17px;font-weight:700;color:var(--ink)}
.scrim{position:fixed;inset:0;background:rgba(20,28,45,.55);display:flex;align-items:flex-end;justify-content:center;z-index:50}
@media(min-width:560px){.scrim{align-items:center;padding:20px}}
.modal{background:#fff;border-radius:12px 12px 0 0;width:100%;max-width:560px;max-height:86vh;overflow:auto;box-shadow:0 -8px 40px rgba(0,0,0,.25)}
@media(min-width:560px){.modal{border-radius:10px}}
.modal-h{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff;z-index:2}
.modal-h h3{margin:0;font-size:15px;display:flex;align-items:center;gap:8px}
.saved-row{display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid #EEF0F3}
.saved-row:hover{background:#F7F9FA}
.saved-row .meta{flex:1;min-width:0}
.saved-row .nm{font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.saved-row .dt{font-size:11px;color:var(--muted);font-family:var(--mono)}
.empty{padding:24px 16px;text-align:center;color:var(--muted);font-size:13px}
.banner{background:var(--accent-soft);border-bottom:1px solid #BFE0E3;padding:9px 16px;font-size:12px;color:var(--accent-ink);font-weight:600}
.addrow{display:flex;gap:7px;padding:11px 16px;border-bottom:1px solid #EEF0F3;align-items:center}
.cathead{display:flex;align-items:center;gap:8px;padding:10px 16px;background:#F4F6F8;border-bottom:1px solid var(--line);cursor:pointer}
.catname{font-weight:700;font-size:13px;flex:1;color:var(--ink)}
.catcount{font-family:var(--mono);font-size:11px;color:var(--muted)}
.libitem{display:flex;gap:6px;align-items:center;padding:8px 16px;border-bottom:1px solid #F2F3F5}
.libitem input{border:1px solid var(--line);border-radius:4px;padding:5px 7px;font-size:12px;outline:none;background:#fff}
.libitem .d{flex:1;min-width:0}
.libitem .u{width:64px}
.libitem .p{width:80px;font-family:var(--mono);text-align:right}
.ctrow{padding:10px 16px;border-bottom:1px solid #EEF0F3}
.ctrow .nm{font-weight:700;font-size:13px}
.ctrow .dt{font-size:11px;color:var(--muted);line-height:1.5;margin-top:2px}
.ctrow .acts{display:flex;gap:6px;margin-top:7px}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;font-size:12.5px;font-weight:600;padding:9px 16px;border-radius:20px;z-index:60;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.foot{font-size:11px;color:var(--muted);text-align:center;margin:14px 0 4px;line-height:1.5}
.note{display:flex;gap:7px;align-items:flex-start;background:var(--accent-soft);border:1px solid #BFE0E3;border-radius:6px;padding:9px 11px;font-size:11.5px;color:var(--accent-ink);line-height:1.4;margin-bottom:11px}
.collapse.hide{display:none}
.gate{min-height:100vh;background:linear-gradient(160deg,#2E2F2F 0%,#242525 100%);display:flex;align-items:center;justify-content:center;padding:24px}
.gate-card{background:#fff;border-radius:14px;padding:30px 26px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.gate-logo{height:38px;object-fit:contain;margin-bottom:18px}
.gate-h{font-size:20px;font-weight:800;color:var(--ink);letter-spacing:-.01em;margin:0 0 4px}
.gate-sub{font-size:13px;color:var(--muted);margin:0 0 20px;line-height:1.5}
.user-card{display:flex;align-items:center;gap:12px;width:100%;border:1px solid var(--line2);border-radius:10px;padding:13px 14px;margin-bottom:9px;cursor:pointer;background:#fff;text-align:left;transition:border-color .12s}
.user-card:hover{border-color:var(--accent)}
.user-av{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:15px;flex-shrink:0}
.user-card .un{font-weight:700;font-size:14px;color:var(--ink)}
.user-card .ur{font-size:11.5px;color:var(--muted)}
.rolechip{font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:20px;margin-left:auto}
.rc-ceo{background:var(--accent);color:#fff}.rc-colab{background:var(--ink);color:#fff}.rc-visor{background:var(--platino);color:var(--ink2)}
.svc-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.svc-card{border:1.5px solid var(--line2);border-radius:12px;padding:22px 16px;cursor:pointer;text-align:center;background:#fff;transition:all .12s}
.svc-card:hover{border-color:var(--accent);transform:translateY(-2px)}
.svc-card.soon{opacity:.62}
.svc-ic{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 11px;color:#fff}
.svc-card h4{margin:0 0 4px;font-size:15px;color:var(--ink)}
.svc-card p{margin:0;font-size:11.5px;color:var(--muted);line-height:1.4}
.svc-soon{display:inline-block;margin-top:8px;font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;background:var(--platino);color:var(--muted);padding:2px 9px;border-radius:20px}
.gate-link{background:none;border:none;color:var(--accent-ink);font-weight:700;font-size:12.5px;cursor:pointer;padding:0}
.ro-banner{background:#FBF4E9;border:1px solid #E6D4AE;color:#8A6D3B;border-radius:7px;padding:9px 13px;font-size:12px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.userbar{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:9px;padding:8px 11px;margin-bottom:11px;flex-wrap:wrap}
.doctabs{display:flex;align-items:center;gap:4px;margin-bottom:11px;flex-wrap:wrap}
.doctab{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line2);border-bottom:2px solid var(--line2);border-radius:8px 8px 0 0;padding:7px 11px;cursor:pointer;max-width:230px;font-size:12px;color:var(--muted)}
.doctab.on{border-bottom-color:var(--accent);color:var(--ink);font-weight:700;background:var(--accent-soft)}
.dt-lbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dt-x{border:none;background:none;color:var(--muted);cursor:pointer;font-size:15px;line-height:1;padding:0 2px;border-radius:4px}
.dt-x:hover{background:var(--line);color:var(--bad)}
.doctab-add{border:1px dashed var(--line2);background:none;color:var(--accent-ink);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px;font-weight:700}
.ub-av{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:12.5px}
.ub-meta{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink)}
.netbadge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;border-radius:20px;padding:4px 10px;border:1px solid var(--line2);background:#fff;cursor:default}
.netbadge i{width:8px;height:8px;border-radius:50%;background:var(--good);display:inline-block}
.netbadge.on{color:var(--good);border-color:#BFE0CB;background:#EAF4EE}
.netbadge.off{color:var(--warn);cursor:pointer}
.menubar{display:flex;align-items:center;gap:2px;background:var(--ink);border-radius:8px;padding:3px 6px;margin-bottom:10px;position:relative;z-index:40}
.mb-brand{color:#fff;font-size:12.5px;margin-right:10px;opacity:.92;letter-spacing:.01em;display:inline-flex;align-items:center;gap:7px}
.mb-brand b{color:var(--accent)}
.mb-logochip{background:#fff;border-radius:6px;padding:3px 8px;display:inline-flex;align-items:center;height:23px}
.mb-logochip img{height:15px;display:block;object-fit:contain}
.mb-item{position:relative}
.mb-top{background:none;border:none;color:#DfE0E0;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:6px;cursor:pointer}
.mb-top:hover,.mb-top.on{background:rgba(255,255,255,.12);color:#fff}
.mb-drop{position:absolute;top:100%;left:0;margin-top:3px;background:#fff;border:1px solid var(--line2);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.22);padding:5px;min-width:210px;z-index:50}
.mb-drop .mi{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:none;border:none;padding:8px 10px;border-radius:6px;font-size:12.5px;color:var(--ink2);cursor:pointer}
.mb-drop .mi:hover{background:var(--accent-soft);color:var(--accent-ink)}
.mb-div{height:1px;background:var(--line);margin:4px 6px}
.mi.has-sub{position:relative;display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:8px 10px;border-radius:6px;font-size:12.5px;color:var(--ink2);cursor:default}
.mi.has-sub:hover{background:var(--accent-soft);color:var(--accent-ink)}
.mb-subdrop{display:none;position:absolute;left:100%;top:-5px;margin-left:2px;background:#fff;border:1px solid var(--line2);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.22);padding:5px;min-width:170px}
.mi.has-sub:hover .mb-subdrop{display:block}
.mb-user{color:#B7B8B8;font-size:11.5px;margin-right:6px}
.mb-overlay{position:fixed;inset:0;z-index:35}
.verrow{display:flex;align-items:center;gap:10px;padding:8px 8px;border-bottom:1px solid var(--line);cursor:pointer;border-radius:6px}
.verrow:hover{background:var(--accent-soft)}
.verchip{font-family:var(--mono);font-size:11px;font-weight:800;color:#fff;background:var(--muted);border-radius:5px;padding:2px 7px;min-width:34px;text-align:center}
.usd-row{display:flex;align-items:center;gap:8px;margin-top:7px;padding:6px 9px;background:var(--accent-soft);border-radius:7px;font-size:11.5px;color:var(--ink2)}
.adic-part{display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 9px;background:#F3F1EC;border-radius:7px;font-size:11.5px}
.tcbcb-row{display:flex;align-items:center;gap:9px;margin-top:8px;padding:7px 10px;background:#EAF4EE;border:1px solid #BFE0CB;border-radius:7px;font-size:11.5px;color:var(--ink2);flex-wrap:wrap}
.fp-edit{border-top:1px solid var(--line);padding:11px 13px 13px}
.fp-head{display:flex;align-items:center;gap:7px;font-size:12.5px;margin-bottom:9px}
.fp-row{display:flex;align-items:center;gap:7px;padding:4px 0}
.fp-n{font-family:var(--mono);font-size:11px;color:var(--muted);width:16px}
.fp-client{margin-top:22px}
.fp-title{font-size:12px;font-weight:800;letter-spacing:.05em;color:var(--ink);border-bottom:2px solid var(--accent);padding-bottom:4px;display:inline-block;margin-bottom:9px}
.fp-tot td{background:var(--platino);font-weight:800}
.fp-note{font-size:10.5px;color:var(--muted);margin-top:7px;line-height:1.5}
.stickytot{position:sticky;bottom:0;z-index:30;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--ink);color:#fff;border-radius:10px;padding:9px 14px;margin-top:14px;box-shadow:0 -4px 18px rgba(0,0,0,.18)}
.st-main,.st-marg{display:flex;flex-direction:column;line-height:1.15}
.st-lb{font-size:9px;letter-spacing:.08em;color:#AEB0B0;font-weight:800}
.st-val{font-family:var(--mono);font-size:19px;font-weight:800}
.st-sub{font-size:10px;color:#AEB0B0;font-family:var(--mono)}
.stickytot .btn{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22);color:#fff}
.stickytot .btn:hover{background:rgba(255,255,255,.18)}
.stickytot .btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.stickytot .btn:disabled{opacity:.4;cursor:default}
.rev-row{display:flex;align-items:flex-start;gap:9px;padding:8px 2px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--ink2)}
.rev-dot{width:9px;height:9px;border-radius:50%;margin-top:4px;flex-shrink:0}
.rev-alto .rev-dot{background:var(--bad)}.rev-medio .rev-dot{background:var(--warn)}.rev-bajo .rev-dot{background:var(--muted)}
.item-compact{display:flex;align-items:center;gap:9px;padding:8px 13px;border-bottom:1px solid var(--line);cursor:default;background:#FCFCFB}
.item-compact:hover{background:var(--accent-soft)}
.ic-chev{border:none;background:none;cursor:pointer;color:var(--muted);padding:2px;border-radius:4px;display:flex}
.ic-chev:hover{background:var(--line);color:var(--accent-ink)}
.ic-no{font-size:10.5px;color:var(--muted);min-width:30px}
.ic-desc{flex:1;font-size:12.5px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ic-ct{color:var(--muted);font-size:11px;margin-left:5px}
.ic-q{font-size:11px;color:var(--muted);min-width:74px;text-align:right}
.ic-pu{font-size:11.5px;color:var(--ink2);min-width:74px;text-align:right}
.ic-tot{font-size:12.5px;font-weight:700;min-width:96px;text-align:right}
.col-ctrls{display:flex;align-items:center;gap:4px}
.cc-lb{font-size:10px;color:var(--muted);font-weight:700;margin-right:2px}
.cc-b{border:1px solid var(--line2);background:#fff;border-radius:6px;font-size:10.5px;font-weight:800;padding:3px 8px;cursor:pointer;color:var(--ink2)}
.cc-b:hover{background:var(--accent-soft);color:var(--accent-ink);border-color:var(--accent)}
.cc-b.a{color:var(--accent-ink)}.cc-b.b{color:var(--ink)}.cc-b.c{color:#8A6D3B}
.chart-box{padding:14px 2px;page-break-inside:avoid}
.ch-t{font-size:11.5px;font-weight:800;color:var(--ink);margin-bottom:8px}
.ch-note{font-size:10.5px;color:var(--muted);margin-top:6px}
.b-adj{background:#F0E6D2;color:#8A6D3B}
.dc-note{padding:9px 13px;font-size:11.5px;color:var(--ink2);background:#FAFAF8;border-bottom:1px solid var(--line);line-height:1.5}
.drag-h{cursor:grab;color:var(--muted);font-size:14px;line-height:1;padding:2px 3px;border-radius:4px;user-select:none;flex-shrink:0}
.drag-h:hover{background:var(--line);color:var(--accent-ink)}
.drag-h:active{cursor:grabbing}
.sec-name{text-transform:uppercase}
.umodal-row{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:9px;flex-wrap:wrap}
.perm-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.perm-tog{font-size:10.5px;font-weight:700;border:1px solid var(--line2);background:#fff;color:var(--muted);border-radius:16px;padding:3px 9px;cursor:pointer}
.perm-tog.on{background:var(--good);color:#fff;border-color:var(--good)}
fieldset.rofs{border:0;margin:0;padding:0;min-width:0}
.collapse.hide{display:none}
`;

/* ============================== CÁLCULO ============================== */
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const fmt = (n) => (isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const has = (v) => v !== "" && v !== null && v !== undefined;

function saleFactor(gg, util, p) {
  const iva = (p.ivaPct ?? 13) / 100, itx = (p.itPct ?? 3) / 100, ggc = (p.ggCredPct ?? 0) / 100;
  const denom = 1 - iva - itx;
  return denom > 0 ? ((1 + gg) * util + (1 - iva) + gg * (1 - iva * ggc)) / denom : 0;
}
const itemTC = (it) => (it.puMoneda === "US$" ? (num(it.puTC) || 1) : 1);
function computeItem(it, p) {
  const ggPct = it.ggPct ?? p.ggDefault ?? 8, utilPct = it.utilPct ?? p.utilDefault ?? 15;
  const gg = ggPct / 100, util = utilPct / 100, iva = (p.ivaPct ?? 13) / 100, itx = (p.itPct ?? 3) / 100, iue = (p.iuePct ?? 25) / 100, ggc = (p.ggCredPct ?? 0) / 100;
  const m = p._saleMul || 1; const sf = saleFactor(gg, util, p);
  const cant = num(it.cantidad); const cur = itemTC(it);
  const e = it.precioFinal ? (sf > 0 ? num(it.puFinal) * cur / sf : 0) : num(it.puDirecto) * cur;
  const cd = cant * e, ggBs = cd * gg;
  const ivaCredLost = it.sinCredito ? iva * cd : 0;          // IVA no recuperable (sin factura de terceros)
  const utilidad = (cd + ggBs) * util - ivaCredLost;         // el IVA sin crédito sale de la utilidad
  const puVentaBase = e * sf, baseTotal = cant * puVentaBase;
  const puVenta = puVentaBase * m, total = baseTotal * m, incidBs = total - baseTotal;
  const ivaNeto = iva * (baseTotal - cd - ggBs * ggc) + ivaCredLost;
  return { cant, e, cd, ggBs, utilidad, puVenta, total, baseTotal, incidBs, ivaNeto, itBs: itx * baseTotal, utilNeta: utilidad * (1 - iue), ggPct, utilPct, ivaCredLost };
}
function baseCD(sections) { let t = 0; sections.forEach((s) => s.items.forEach((it) => { t += num(it.cantidad) * num(it.puDirecto) * itemTC(it); })); return t; }
function incidAmounts(sections, p) {
  const list = p.incidencias || [];
  const iva = (p.ivaPct ?? 13) / 100, itx = (p.itPct ?? 3) / 100, iue = (p.iuePct ?? 25) / 100, ggc = (p.ggCredPct ?? 0) / 100;
  const total0 = computeTotals(sections, { ...p, _saleMul: 1, _incidT: null }).total;
  let A = 0, B = 0; // A: sale from fixed incidences · B: sale weight from %-of-total incidences
  list.forEach((x) => {
    const gg = num(x.gg ?? p.ggDefault ?? 8) / 100, util = num(x.util ?? p.utilDefault ?? 15) / 100, sf = saleFactor(gg, util, p);
    if (x.tipo === "pct") B += (num(x.valor) / 100) * sf; else A += num(x.valor) * sf;
  });
  const denom = 1 - B, finalTotal = total0 > 0 ? (total0 + A) / (denom > 0.05 ? denom : 0.05) : 0;
  const S = finalTotal - total0, m = total0 > 0 ? finalTotal / total0 : 1;
  let sumCd = 0, sumGg = 0, sumUtil = 0, sumIva = 0, sumIt = 0, sumUtilNeta = 0;
  const items = list.map((x) => {
    const ggP = num(x.gg ?? p.ggDefault ?? 8), utilP = num(x.util ?? p.utilDefault ?? 15), gg = ggP / 100, util = utilP / 100, sf = saleFactor(gg, util, p);
    const cd = x.tipo === "pct" ? num(x.valor) / 100 * finalTotal : num(x.valor);
    const ggBs = cd * gg, utilBs = (cd + ggBs) * util, sale = cd * sf, ivaNeto = iva * (sale - cd - ggBs * ggc), itBs = itx * sale, utilNeta = utilBs * (1 - iue);
    sumCd += cd; sumGg += ggBs; sumUtil += utilBs; sumIva += ivaNeto; sumIt += itBs; sumUtilNeta += utilNeta;
    return { ...x, ggP, utilP, cd, ggBs, utilBs, sale, montoBs: cd };
  });
  return { m, total0, finalTotal, S, items, totalCosto: sumCd, totalSale: S, T: { cd: sumCd, gg: sumGg, util: sumUtil, iva: sumIva, it: sumIt, utilNeta: sumUtilNeta } };
}
function sectionTotal(s, p) { let t = 0; s.items.forEach((it) => { t += computeItem(it, p).total; }); return t; }
function discountInfo(T, params, meta) {
  const list = params.descuentos || [];
  let D_fijo = 0, d = 0;
  list.forEach((x) => { if (x.tipo === "pct") d += num(x.valor) / 100; else D_fijo += num(x.valor); });   // descuentos fijos en Bs (interno)
  if (d > 0.95) d = 0.95;
  const S_shown = T > 0 ? (T + D_fijo) / (1 - d) : 0, mDisc = T > 0 ? S_shown / T : 1;
  const items = list.map((x) => ({ ...x, montoBs: x.tipo === "pct" ? num(x.valor) / 100 * S_shown : num(x.valor) }));
  const totalDescBs = S_shown - T;
  return { mDisc, S_shown, totalDescBs, items, hasDisc: items.length > 0 && totalDescBs > 0.005 };
}
function computeTotals(sections, p) {
  const t = { cd: 0, ggBs: 0, utilidad: 0, ivaNeto: 0, itBs: 0, total: 0, utilNeta: 0, grpA: 0, grpB: 0, grpC: 0, incid: 0 };
  sections.forEach((s) => {
    if (s.grupo === "C") { s.items.forEach((it) => { t.grpC += num(it.monto); }); return; }
    const g = s.grupo === "B" ? "grpB" : "grpA"; s.items.forEach((it) => { const c = computeItem(it, p); t.cd += c.cd; t.ggBs += c.ggBs; t.utilidad += c.utilidad; t.ivaNeto += c.ivaNeto; t.itBs += c.itBs; t.total += c.total; t.utilNeta += c.utilNeta; t.incid += c.incidBs; t[g] += c.total; });
  });
  const T = p._incidT;
  if (T) { t.cd += T.cd; t.ggBs += T.gg; t.utilidad += T.util; t.ivaNeto += T.iva; t.itBs += T.it; t.utilNeta += T.utilNeta; }
  return t;
}
const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
const montoAdic = (a) => { const cur = a.moneda === "US$" ? (num(a.tc) || 1) : 1; return (has(a.cantidad) || has(a.pu)) ? num(a.cantidad) * num(a.pu) * cur : num(a.monto) * cur; };
function realOf(it, p) {
  const qCot = num(it.cantidad); const cur = itemTC(it); let pCot = num(it.puDirecto) * cur;
  if (it.precioFinal && p) { const gg = (it.ggPct ?? p.ggDefault ?? 8) / 100, util = (it.utilPct ?? p.utilDefault ?? 15) / 100, sf = saleFactor(gg, util, p); pCot = sf > 0 ? num(it.puFinal) * cur / sf : 0; }
  const qReal = has(it.cantReal) ? num(it.cantReal) : qCot;
  const pReal = has(it.puReal) ? num(it.puReal) : pCot;
  return { qCot, pCot, cotizado: qCot * pCot, qReal, pReal, contratado: qReal * pReal };
}
function payables(sections, p) {
  const map = {};
  sections.forEach((s, si) => s.items.forEach((it, ii) => {
    const r = realOf(it, p); if (r.cotizado <= 0 && r.contratado <= 0) return;
    const ct = it.contratista || {}; const idc = norm(ct.nombre) || (ct.nit || "").trim() || norm(ct.razonSocial); const hasCt = !!idc;
    const key = hasCt ? idc : "__none__";
    if (!map[key]) map[key] = { key, info: {}, items: [], total: 0, totalCot: 0, none: !hasCt };
    ["nombre", "contacto", "correo", "razonSocial", "nit"].forEach((k) => { if (ct[k]) map[key].info[k] = ct[k]; });
    map[key].items.push({ sid: s.id, iid: it.id, no: `${si + 1}.${ii + 1}`, descripcion: it.descripcion, unidad: it.unidad,
      qCot: r.qCot, pCot: r.pCot, cotizado: r.cotizado, cantReal: it.cantReal, puReal: it.puReal, qReal: r.qReal, pReal: r.pReal, contratado: r.contratado });
    map[key].total += r.contratado; map[key].totalCot += r.cotizado;
  }));
  const list = Object.values(map).sort((a, b) => a.none - b.none || b.total - a.total);
  return { list, count: list.filter((x) => !x.none).length };
}
function CashFlowView({ cf, meta, rate, sym }) {
  const M = (x) => sym + " " + fmt(x / rate);
  return (<div>
    <div className="kpis" style={{ marginBottom: 12 }}>
      <div className="kpi"><div className="k">Cobrado</div><div className="v" style={{ color: "var(--good)" }}>{M(cf.ingCobr)}</div></div>
      <div className="kpi"><div className="k">Por cobrar</div><div className="v">{M(cf.ingPorCobrar)}</div></div>
      <div className="kpi"><div className="k">Pagado</div><div className="v">{M(cf.egrPagado)}</div></div>
      <div className="kpi"><div className="k">Caja hoy</div><div className="v" style={{ color: cf.cajaHoy >= -0.005 ? "var(--good)" : "var(--bad)" }}>{M(cf.cajaHoy)}</div></div>
    </div>
    {(cf.serie || []).length > 0 && (<div className="crep" style={{ padding: "12px 12px 4px", marginBottom: 12 }}>
      <div className="ch-t">Ingresos, egresos y caja acumulada por mes</div>
      <CashChart serie={cf.serie} rate={rate} sym={sym} />
    </div>)}
    {(cf.serieFin || []).length > 0 && (<div className="crep" style={{ padding: "12px 12px 4px", marginBottom: 12 }}>
      <div className="ch-t">Ejecutado vs. cobrado vs. pagado en el tiempo</div>
      <CurvaFinanciera serie={cf.serieFin} rate={rate} sym={sym} />
    </div>)}
    <div className="crep" style={{ padding: 0, marginBottom: 12 }}>
      <div className="ec-head" style={{ padding: "9px 12px" }}><span>Ingresos · hitos de pago del cliente</span><span className="amt">{M(cf.ingPrev)}</span></div>
      <table className="ectable"><thead><tr><th>Hito</th><th>Fecha estimada</th><th className="r">%</th><th className="r">Previsto</th><th>Estado</th><th className="r">Cobrado</th></tr></thead>
        <tbody>{cf.hitos.length === 0 ? <tr><td colSpan={6} style={{ color: "var(--muted)" }}>Sin hitos definidos. Cárgalos en “Forma de pago”.</td></tr>
          : cf.hitos.map((h, i) => (<tr key={h.id}><td>{i + 1}. {h.detalle || "—"}</td><td>{h.fechaEst || "—"}</td><td className="r mono">{fmt(num(h.pct))}%</td><td className="r mono">{fmt(h.previsto / rate)}</td>
            <td><span className={"estchip est-" + (h.cobrado ? "ok" : "no")}>{h.cobrado ? "Cobrado" + (h.fechaReal ? " " + h.fechaReal : "") : "Por cobrar"}</span></td>
            <td className="r mono" style={{ color: h.cobrado ? "var(--good)" : "var(--muted)" }}>{h.cobrado ? fmt(h.cobradoBs / rate) : "—"}</td></tr>))}
        </tbody></table>
    </div>
    <div className="crep" style={{ padding: 0 }}>
      <div className="ec-head" style={{ padding: "9px 12px" }}><span>Egresos comprometidos (contratistas y compras)</span><span className="amt">{M(cf.egrComprometido)}</span></div>
      <table className="ectable"><tbody>
        <tr><td>Total contratado / comprometido</td><td className="r mono">{fmt(cf.egrComprometido / rate)}</td></tr>
        <tr><td>Pagado a la fecha</td><td className="r mono" style={{ color: "var(--good)" }}>{fmt(cf.egrPagado / rate)}</td></tr>
        <tr><td><b>Saldo por pagar</b></td><td className="r mono" style={{ fontWeight: 800, color: cf.egrPorPagar > 0.005 ? "var(--warn)" : "var(--ink)" }}>{fmt(cf.egrPorPagar / rate)}</td></tr>
      </tbody></table>
    </div>
    <div className="ec-block" style={{ marginTop: 12 }}>
      <div className="ec-head"><span>Proyección de la obra</span><span className="amt" style={{ color: cf.cajaProyectada >= -0.005 ? "var(--good)" : "var(--bad)" }}>{M(cf.cajaProyectada)}</span></div>
      <table className="ectable"><tbody>
        <tr><td>Ingresos previstos (precio de cierre)</td><td className="r mono">{fmt(cf.ingPrev / rate)}</td></tr>
        <tr><td>Egresos comprometidos</td><td className="r mono">− {fmt(cf.egrComprometido / rate)}</td></tr>
        <tr><td><b>Resultado proyectado de la obra</b></td><td className="r mono" style={{ fontWeight: 800, color: cf.cajaProyectada >= -0.005 ? "var(--good)" : "var(--bad)" }}>{fmt(cf.cajaProyectada / rate)}</td></tr>
      </tbody></table>
    </div>
    <p className="foot">Caja hoy = cobrado − pagado. Te dice con cuánto cuentas realmente para compras y anticipos. El resultado proyectado anticipa cómo cerrará la obra si todo se ejecuta como está contratado. Vista privada.</p>
  </div>);
}
function cashFlow(meta, cierreBs, pa2, pa, contractors, informe, avanceActual) {
  const pagos = (meta.pagos || []).filter((h) => num(h.pct) > 0 || (h.detalle || "").trim());
  const hitos = pagos.map((h) => { const prev = cierreBs * num(h.pct) / 100; const real = h.cobrado ? (has(h.montoReal) ? num(h.montoReal) : prev) : 0; return { ...h, previsto: prev, cobradoBs: real }; });
  const ingPrev = hitos.reduce((a, h) => a + h.previsto, 0);
  const ingCobr = hitos.reduce((a, h) => a + h.cobradoBs, 0);
  const egrComprometido = pa ? num(pa.totalC) : (pa2 ? pa2.tot.contratado + pa2.tot.extras : 0);
  const egrPagado = pa ? num(pa.totalP) : 0;
  return {
    hitos, ingPrev, ingCobr, ingPorCobrar: ingPrev - ingCobr,
    egrComprometido, egrPagado, egrPorPagar: egrComprometido - egrPagado,
    cajaHoy: ingCobr - egrPagado, cajaProyectada: ingPrev - egrComprometido, serie: cashSeries(meta, contractors || {}, cierreBs),
    serieFin: finanzasSerie(meta, contractors || {}, informe, cierreBs, avanceActual),
  };
}
function cierreFrom(meta, totalBs, params) {
  const listaBs = totalBs, cBs = num(meta.precioCierre) > 0 ? num(meta.precioCierre) : 0;   // precio de cierre en Bs (interno)
  if (!(cBs > 0 && listaBs > 0)) return { activo: false, listaBs, cierreBs: listaBs, descBs: 0, factor: 1, pct: 0, modo: meta.cierreModo || "visible" };
  return { activo: true, listaBs, cierreBs: cBs, descBs: listaBs - cBs, factor: cBs / listaBs, pct: (listaBs - cBs) / listaBs * 100, modo: meta.cierreModo || "visible" };
}
function partidaAccounts(sections, p, contractors) {
  const extrasBySec = {}; let extrasSinPartida = 0;
  Object.entries(contractors || {}).forEach(([key, ov]) => {
    (ov.adicionales || []).forEach((a) => {
      const m = montoAdic(a); if (m <= 0.005 && !(a.descripcion || "").trim()) return;
      if (a.partidaId) { (extrasBySec[a.partidaId] = extrasBySec[a.partidaId] || []).push({ ...a, monto: m, contratista: (ov.info && ov.info.nombre) || key }); }
      else extrasSinPartida += m;
    });
  });
  const rows = sections.filter((s) => s.grupo !== "C").map((s) => {
    let cot = 0, con = 0;
    s.items.forEach((it) => { const r = realOf(it, p); cot += r.cotizado; con += r.contratado; });
    const ex = (extrasBySec[s.id] || []).reduce((a, x) => a + x.monto, 0);
    return { id: s.id, nombre: s.nombre, grupo: s.grupo, cotizado: cot, contratado: con, extras: ex, extraList: extrasBySec[s.id] || [], resguardo: cot - con - ex };
  });
  const tot = rows.reduce((a, r) => ({ cotizado: a.cotizado + r.cotizado, contratado: a.contratado + r.contratado, extras: a.extras + r.extras, resguardo: a.resguardo + r.resguardo }), { cotizado: 0, contratado: 0, extras: 0, resguardo: 0 });
  tot.extrasSinPartida = extrasSinPartida; tot.resguardoNeto = tot.resguardo - extrasSinPartida;
  return { rows, tot };
}
function contractorAccount(valor, ov) {
  const hitos = (ov.hitos || []).map((h) => { const prog = (num(h.pct) / 100) * valor; const pag = h.pagado ? (has(h.montoPagado) ? num(h.montoPagado) : prog) : 0; return { ...h, prog, pag }; });
  const pctSum = (ov.hitos || []).reduce((a, h) => a + num(h.pct), 0);
  const princPagado = hitos.reduce((a, h) => a + h.pag, 0);
  const adic = (ov.adicionales || []).map((a) => { const montoN = montoAdic(a), pag = a.pagado ? (has(a.montoPagado) ? num(a.montoPagado) : montoN) : 0; return { ...a, montoN, pag }; });
  const adicValor = adic.reduce((a, x) => a + x.montoN, 0), adicPagado = adic.reduce((a, x) => a + x.pag, 0);
  return { hitos, pctSum, princPagado, princSaldo: valor - princPagado, adic, adicValor, adicPagado, adicSaldo: adicValor - adicPagado, contratadoTotal: valor + adicValor, pagadoTotal: princPagado + adicPagado, saldoTotal: (valor + adicValor) - (princPagado + adicPagado) };
}
function projectAccounts(sections, p, contractors) {
  const pay = payables(sections, p); const rows = []; const milestones = {}; const order = [];
  let princCot = 0, princC = 0, princP = 0, adicC = 0, adicP = 0, sinCot = 0, sinC = 0, sinItems = 0;
  pay.list.forEach((c) => {
    if (c.none) {
      sinCot += c.totalCot; sinC += c.total; sinItems += c.items.length;
      rows.push({ nombre: "SIN ASIGNACIÓN", none: true, cotizado: c.totalCot, contratado: c.total, margen: c.totalCot - c.total, pagado: 0, saldo: c.total });
      return;
    }
    const acc = contractorAccount(c.total, contractors[c.key] || {});
    princCot += c.totalCot; princC += c.total; princP += acc.princPagado; adicC += acc.adicValor; adicP += acc.adicPagado;
    acc.hitos.forEach((h) => { const nm = (h.nombre || "—").trim() || "—"; if (!(nm in milestones)) { milestones[nm] = { prog: 0, pag: 0 }; order.push(nm); } milestones[nm].prog += h.prog; milestones[nm].pag += h.pag; });
    rows.push({ nombre: c.info.nombre || c.info.razonSocial || "—", cotizado: c.totalCot, contratado: c.total, margen: c.totalCot - c.total, pagado: acc.pagadoTotal, saldo: acc.saldoTotal });
  });
  const cotBase = princCot + sinCot, contrBase = princC + sinC;
  return {
    rows, order, milestones,
    princCot, princC, princP, princS: princC - princP, adicC, adicP, adicS: adicC - adicP,
    sinCot, sinC, sinItems, cotBase, contrBase, margen: cotBase - contrBase,
    totalC: princC + adicC, totalP: princP + adicP, totalS: (princC + adicC) - (princP + adicP),
  };
}

function quoteKPIs(q) {
  const params = normalizeParams(q.params), meta = q.meta || {}, sections = q.sections || [], contractors = q.contractors || {}, cobros = q.cobros || [];
  const ib = incidAmounts(sections, params);
  const eParams = { ...params, _saleMul: ib.m, _incidT: ib.T };
  const totals = computeTotals(sections, eParams), pa = projectAccounts(sections, params, contractors);
  const iue = (params.iuePct ?? 25) / 100;
  const cz = cierreFrom(meta, totals.total, params);
  const cotizado = cz.cierreBs;                                   // precio final acordado con el cliente
  const utilProyD = (totals.utilidad - cz.descBs) * (1 - iue), utilRealA = totals.utilidad - cz.descBs + pa.margen, utilRealD = utilRealA * (1 - iue);
  const hitos = (meta.pagos || []).filter((h) => num(h.pct) > 0);
  const cobradoHitos = hitos.reduce((a, h) => a + (h.cobrado ? (has(h.montoReal) ? num(h.montoReal) : cotizado * num(h.pct) / 100) : 0), 0);
  const cobrado = hitos.length ? cobradoHitos : cobros.reduce((a, x) => a + num(x.monto), 0), pagado = pa.totalP;
  const rentReal = cotizado > 0 ? utilRealD / cotizado * 100 : 0;
  return { nombre: meta.proyecto || q.nombre || "—", codigo: meta.codigo || "", estado: meta.estado || "Cotizada", cliente: meta.cliente || "",
    cotizado, descComercial: cz.descBs, utilProyD, utilRealD, margen: pa.margen, contratado: pa.totalC, cobrado, pagado, caja: cobrado - pagado, porCobrar: cotizado - cobrado, porPagar: pa.totalS, rentReal, sup: num(meta.superficie) };
}

const DEFAULT_PARAMS = { ggOptions: [12, 10, 8], utilOptions: [15, 12.5, 10], ggDefault: 8, utilDefault: 15, ivaPct: 13, itPct: 3, iuePct: 25, ggCredPct: 0, incidencias: [], descuentos: [], tcOficial: 9.76, tcReal: 9.89 };
function normalizeParams(p) { p = p || {}; const legacy = []; if (p.incidFijo && num(p.incidFijo) > 0) legacy.push({ id: uid(), nombre: "Costo fijo", tipo: "fijo", valor: p.incidFijo }); if (p.incidPct && num(p.incidPct) > 0) legacy.push({ id: uid(), nombre: "Otras incidencias", tipo: "pct", valor: p.incidPct }); return { ggOptions: p.ggOptions || [12, 10, 8], utilOptions: p.utilOptions || [15, 12.5, 10], ggDefault: p.ggDefault ?? p.ggPct ?? 8, utilDefault: p.utilDefault ?? p.utilPct ?? 15, ivaPct: p.ivaPct ?? 13, itPct: p.itPct ?? 3, iuePct: p.iuePct ?? 25, ggCredPct: p.ggCredPct ?? 0, incidencias: p.incidencias || legacy, descuentos: p.descuentos || [], tcOficial: p.tcOficial ?? 9.76, tcReal: p.tcReal ?? 9.89 }; }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toLocaleDateString("es-BO");
const yy = () => String(new Date().getFullYear()).slice(-2);
const codeNum = (c) => { const s = String(c || ""); let m = s.match(/_(\d+)_\d+\s*$/); if (m) return parseInt(m[1], 10); m = s.match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0; };
const fmtCode = (n) => "OCS_CON_" + String(n).padStart(3, "0") + "_" + yy();
const fmtCodePro = (n) => "OCS_PRO_" + String(n).padStart(3, "0") + "_" + yy();
const fmtDate = (ts) => { try { return new Date(ts).toLocaleDateString("es-BO") + " " + new Date(ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
function FirmaBlock({ firmante }) {
  const f = firmante || {};
  const nombre = ((f.nombre || "") + " " + (f.apellidos || "")).trim();
  return (<div className="rep-firma">
    {f.firma ? <img src={f.firma} alt="firma" style={{ height: 52, marginBottom: 0, objectFit: "contain" }} /> : <div style={{ height: 34 }} />}
    <div className="rf-line" />
    <b className="rf-nom">{nombre || "ORIGINA GROUP S.R.L."}</b>
    {f.cargo && <span className="rf-cargo">{f.cargo}</span>}
    <span className="rf-emp">ORIGINA GROUP S.R.L.</span>
    <span className="rf-mail">{f.email || guessMail(f.nombre) || "contacto@origina-group.com"}</span>
  </div>);
}
function MenuBar({ menu, setMenu, menus, right }) {
  return (<>
    <div className="menubar no-print">
      <span className="mb-brand"><span className="mb-logochip"><img src={DEFAULT_MINILOGO} alt="OG" /></span> Cotizador</span>
      {menus.map((m) => (<div className="mb-item" key={m.id}>
        <button className={"mb-top" + (menu === m.id ? " on" : "")} onClick={() => setMenu(menu === m.id ? null : m.id)}>{m.label}</button>
        {menu === m.id && (<div className="mb-drop">
          {m.items.filter((it) => it && it.show !== false).map((it, i) => it.divider ? <div className="mb-div" key={i} /> : <button className="mi" key={i} onClick={() => { setMenu(null); it.onClick && it.onClick(); }}>{it.icon}{it.label}</button>)}
        </div>)}
      </div>))}
      <span style={{ flex: 1 }} />
      {right}
    </div>
    {menu && <div className="mb-overlay no-print" onClick={() => setMenu(null)} />}
  </>);
}
/* ---- Limpieza de textos (prolijidad, sin cambiar el significado) ---- */
function limpiarTexto(t, opts) {
  let x = String(t == null ? "" : t);
  x = x.replace(/\s+/g, " ").trim();                      // espacios múltiples
  x = x.replace(/\s+([,;:.!?])/g, "$1");                  // espacio antes de puntuación
  x = x.replace(/([,;:])(?=\S)/g, "$1 ");                 // falta espacio después de coma
  x = x.replace(/\b(\p{L}{2,})\s+\1\b/giu, "$1");         // palabra repetida seguida
  x = x.replace(/\s*\.\s*$/, "");                          // punto final suelto
  if (opts && opts.mayus) return x.toLocaleUpperCase("es-BO");
  if (opts && opts.capital && x) x = x.charAt(0).toLocaleUpperCase("es-BO") + x.slice(1);
  return x;
}
function revisarTexto(t) {
  const x = String(t == null ? "" : t); const obs = [];
  if (/\s{2,}/.test(x)) obs.push("espacios dobles");
  if (/\s+[,;:.]/.test(x)) obs.push("espacio antes de puntuación");
  if (/\b(\p{L}{2,})\s+\1\b/iu.test(x)) obs.push("palabra repetida");
  if (x.trim() && x.trim() === x.trim().toLocaleUpperCase("es-BO") && x.trim().length > 6) obs.push("todo en mayúsculas");
  return obs;
}
/* ============================== GRÁFICOS (SVG nativo) ============================== */
const dISO = (d) => { try { const x = new Date(d); return isNaN(x) ? null : x; } catch { return null; } };
function CurvaS({ inicio, fin, plazoDias, historial, actual, fechaActual }) {
  const W = 700, H = 260, ml = 44, mr = 14, mt = 14, mb = 34;
  const fi = dISO(inicio); const dias = num(plazoDias) > 0 ? num(plazoDias) : (fi && dISO(fin) ? Math.max(1, Math.round((dISO(fin) - fi) / 86400000)) : 0);
  if (!fi || dias <= 0) return <div className="empty">Define fecha de inicio y plazo para ver el avance en el tiempo.</div>;
  const x = (t) => ml + (W - ml - mr) * Math.max(0, Math.min(1, t));
  const y = (p) => mt + (H - mt - mb) * (1 - Math.max(0, Math.min(100, p)) / 100);
  const ref = [[x(0), y(0)], [x(1), y(100)]];
  const pts = [...(historial || []).map((h) => ({ t: (dISO(h.fecha) - fi) / 86400000 / dias, p: num(h.pct) })), { t: ((dISO(fechaActual) || new Date()) - fi) / 86400000 / dias, p: num(actual) }]
    .filter((p) => isFinite(p.t)).sort((a, b) => a.t - b.t);
  const real = pts.map((p) => [x(p.t), y(p.p)]);
  const hoyT = (new Date() - fi) / 86400000 / dias;
  const ticks = [0, 25, 50, 75, 100];
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
    {ticks.map((p) => (<g key={p}><line x1={ml} y1={y(p)} x2={W - mr} y2={y(p)} stroke="#E4E3E0" strokeWidth="1" /><text x={ml - 7} y={y(p) + 4} fontSize="10" fill="#8A8B8B" textAnchor="end">{p}%</text></g>))}
    {[0, .25, .5, .75, 1].map((t) => (<text key={t} x={x(t)} y={H - 12} fontSize="9.5" fill="#8A8B8B" textAnchor="middle">{Math.round(dias * t)}d</text>))}
    <polyline points={ref.map((p) => p.join(",")).join(" ")} fill="none" stroke="#AEB0B0" strokeWidth="1.6" strokeDasharray="5 4" />
    {hoyT >= 0 && hoyT <= 1 && <line x1={x(hoyT)} y1={mt} x2={x(hoyT)} y2={H - mb} stroke="#C23D1F" strokeWidth="1" strokeDasharray="3 3" opacity=".6" />}
    {real.length > 1 && <polyline points={real.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" />}
    {real.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === real.length - 1 ? 5 : 3.4} fill="var(--accent)" />)}
    <g transform={`translate(${ml + 6},${mt + 4})`}>
      <line x1="0" y1="0" x2="18" y2="0" stroke="#AEB0B0" strokeWidth="1.6" strokeDasharray="5 4" /><text x="23" y="3.5" fontSize="10" fill="#5B5C5C">Plazo transcurrido (referencia)</text>
      <line x1="182" y1="0" x2="200" y2="0" stroke="var(--accent)" strokeWidth="2.6" /><text x="205" y="3.5" fontSize="10" fill="#5B5C5C">Avance real</text>
    </g>
  </svg>);
}
function BarsPartidas({ rows, rate, sym }) {
  const R = (rows || []).filter((r) => r.cotizado > 0.005).slice(0, 12);
  if (!R.length) return <div className="empty">Sin partidas con valor cotizado.</div>;
  const max = Math.max(...R.map((r) => Math.max(r.cotizado, r.contratado + r.extras)));
  const bh = 15, gap = 15, W = 700, ml = 150, mr = 96;
  const H = R.length * (bh * 2 + gap) + 26;
  const w = (v) => Math.max(0, (W - ml - mr) * (max > 0 ? v / max : 0));
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
    {R.map((r, i) => { const yb = 16 + i * (bh * 2 + gap); return (<g key={r.id}>
      <text x={ml - 8} y={yb + bh} fontSize="10.5" fill="#2E2F2F" textAnchor="end">{(r.nombre || "").slice(0, 24)}</text>
      <rect x={ml} y={yb} width={w(r.cotizado)} height={bh} fill="#C9CCD1" rx="2" />
      <rect x={ml} y={yb + bh + 2} width={w(r.contratado)} height={bh} fill="var(--accent)" rx="2" />
      {r.extras > 0.005 && <rect x={ml + w(r.contratado)} y={yb + bh + 2} width={w(r.extras)} height={bh} fill="#8A6D3B" rx="2" />}
      <text x={W - mr + 6} y={yb + bh - 2} fontSize="9.5" fill="#8A8B8B">cot {fmt(r.cotizado / rate)}</text>
      <text x={W - mr + 6} y={yb + bh * 2 + 1} fontSize="9.5" fill={r.resguardo >= 0 ? "#2E7D4F" : "#B03A2E"}>resg {fmt(r.resguardo / rate)}</text>
    </g>); })}
    <g transform="translate(150,8)">
      <rect x="0" y="-6" width="10" height="8" fill="#C9CCD1" rx="1" /><text x="14" y="1" fontSize="9.5" fill="#5B5C5C">Cotizado</text>
      <rect x="72" y="-6" width="10" height="8" fill="var(--accent)" rx="1" /><text x="86" y="1" fontSize="9.5" fill="#5B5C5C">Contratado</text>
      <rect x="156" y="-6" width="10" height="8" fill="#8A6D3B" rx="1" /><text x="170" y="1" fontSize="9.5" fill="#5B5C5C">Compras extra</text>
    </g>
  </svg>);
}
function CashChart({ serie, rate, sym }) {
  const S = serie || [];
  if (!S.length) return <div className="empty">Aún no hay movimientos con fecha para graficar.</div>;
  const W = 700, H = 250, ml = 52, mr = 14, mt = 16, mb = 30;
  const maxV = Math.max(1, ...S.map((m) => Math.max(m.ing, m.egr)));
  const acum = []; let a = 0; S.forEach((m) => { a += m.ing - m.egr; acum.push(a); });
  const maxA = Math.max(1, ...acum.map(Math.abs));
  const bw = (W - ml - mr) / S.length;
  const yB = (v) => (H - mb) - (H - mt - mb) * (v / maxV);
  const yL = (v) => mt + (H - mt - mb) / 2 - ((H - mt - mb) / 2) * (v / maxA);
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
    <line x1={ml} y1={H - mb} x2={W - mr} y2={H - mb} stroke="#E4E3E0" />
    {S.map((m, i) => { const x0 = ml + i * bw; return (<g key={i}>
      <rect x={x0 + bw * .14} y={yB(m.ing)} width={bw * .32} height={(H - mb) - yB(m.ing)} fill="#2E7D4F" rx="2" />
      <rect x={x0 + bw * .52} y={yB(m.egr)} width={bw * .32} height={(H - mb) - yB(m.egr)} fill="var(--accent)" rx="2" />
      <text x={x0 + bw / 2} y={H - 12} fontSize="9" fill="#8A8B8B" textAnchor="middle">{m.label}</text>
    </g>); })}
    <polyline points={acum.map((v, i) => `${ml + bw * i + bw / 2},${yL(v)}`).join(" ")} fill="none" stroke="#2C4E8A" strokeWidth="2.2" />
    {acum.map((v, i) => <circle key={i} cx={ml + bw * i + bw / 2} cy={yL(v)} r="3" fill="#2C4E8A" />)}
    <g transform={`translate(${ml + 4},${mt - 4})`}>
      <rect x="0" y="-7" width="10" height="8" fill="#2E7D4F" rx="1" /><text x="14" y="0" fontSize="9.5" fill="#5B5C5C">Ingresos</text>
      <rect x="70" y="-7" width="10" height="8" fill="var(--accent)" rx="1" /><text x="84" y="0" fontSize="9.5" fill="#5B5C5C">Egresos</text>
      <line x1="140" y1="-3" x2="158" y2="-3" stroke="#2C4E8A" strokeWidth="2.2" /><text x="163" y="0" fontSize="9.5" fill="#5B5C5C">Caja acumulada</text>
    </g>
  </svg>);
}
function cashSeries(meta, contractors, cierreBs) {
  const buckets = {};
  const put = (fecha, campo, monto) => { const d = dISO(fecha); if (!d || !(monto > 0.005)) return; const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); (buckets[k] = buckets[k] || { ing: 0, egr: 0 })[campo] += monto; };
  (meta.pagos || []).forEach((h) => { const m = has(h.montoReal) && h.cobrado ? num(h.montoReal) : cierreBs * num(h.pct) / 100; put(h.cobrado ? (h.fechaReal || h.fechaEst) : h.fechaEst, "ing", m); });
  Object.values(contractors || {}).forEach((ov) => {
    (ov.hitos || []).forEach((x) => { if (x.pagado) put(x.fecha, "egr", has(x.montoPagado) ? num(x.montoPagado) : 0); });
    (ov.adicionales || []).forEach((x) => { if (x.pagado) put(x.fecha, "egr", has(x.montoPagado) ? num(x.montoPagado) : montoAdic(x)); });
  });
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return Object.keys(buckets).sort().map((k) => { const [y, m] = k.split("-"); return { label: MES[num(m) - 1] + " " + y.slice(2), ing: buckets[k].ing, egr: buckets[k].egr }; });
}
function finanzasSerie(meta, contractors, informe, contratoBs, avanceActual) {
  const ev = [];
  const hist = [...(((informe && informe.historial) || []).map((h) => ({ f: h.fecha, pct: num(h.pct) }))), { f: (informe && informe.fecha) || today(), pct: num(avanceActual) }];
  hist.forEach((h) => { const d = dISO(h.f); if (d && isFinite(h.pct)) ev.push({ ts: d.getTime(), tipo: "ejec", val: contratoBs * h.pct / 100 }); });
  (meta.pagos || []).forEach((h) => { if (!h.cobrado) return; const d = dISO(h.fechaReal || h.fechaEst); if (!d) return; ev.push({ ts: d.getTime(), tipo: "cobr", val: has(h.montoReal) ? num(h.montoReal) : contratoBs * num(h.pct) / 100 }); });
  Object.values(contractors || {}).forEach((ov) => {
    (ov.hitos || []).forEach((x) => { if (!x.pagado) return; const d = dISO(x.fecha); if (d) ev.push({ ts: d.getTime(), tipo: "pag", val: has(x.montoPagado) ? num(x.montoPagado) : 0 }); });
    (ov.adicionales || []).forEach((x) => { if (!x.pagado) return; const d = dISO(x.fecha); if (d) ev.push({ ts: d.getTime(), tipo: "pag", val: has(x.montoPagado) ? num(x.montoPagado) : montoAdic(x) }); });
  });
  if (!ev.length) return [];
  const fechas = [...new Set(ev.map((e) => e.ts))].sort((a, b) => a - b);
  let cobr = 0, pag = 0, ejec = 0;
  return fechas.map((ts) => {
    ev.filter((e) => e.ts === ts).forEach((e) => { if (e.tipo === "cobr") cobr += e.val; else if (e.tipo === "pag") pag += e.val; else ejec = e.val; });
    return { ts, ejec, cobr, pag };
  });
}
function CurvaFinanciera({ serie, rate, sym }) {
  const S = serie || [];
  if (!S.length) return <div className="empty">Aún no hay ejecución, cobros ni pagos con fecha para graficar.</div>;
  const W = 700, H = 260, ml = 62, mr = 14, mt = 16, mb = 34;
  const t0 = S[0].ts, t1 = S[S.length - 1].ts, span = Math.max(1, t1 - t0);
  const maxV = Math.max(1, ...S.map((p) => Math.max(p.ejec, p.cobr, p.pag)));
  const x = (ts) => ml + (W - ml - mr) * (span > 0 ? (ts - t0) / span : 0.5);
  const y = (v) => (H - mb) - (H - mt - mb) * (v / maxV);
  const line = (key) => S.map((p) => `${x(p.ts)},${y(p[key])}`).join(" ");
  const fD = (ts) => { const d = new Date(ts); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
  const short = (v) => { const n = v / rate; return Math.abs(n) >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : fmt(n).replace(/\.00$/, ""); };
  const ult = S[S.length - 1], delta = ult.cobr - ult.ejec;
  return (<div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0, .25, .5, .75, 1].map((f) => { const v = maxV * f; return (<g key={f}><line x1={ml} y1={y(v)} x2={W - mr} y2={y(v)} stroke="#E4E3E0" strokeWidth="1" /><text x={ml - 7} y={y(v) + 4} fontSize="9.5" fill="#8A8B8B" textAnchor="end">{sym} {short(v)}</text></g>); })}
      {S.map((p, i) => (<text key={i} x={x(p.ts)} y={H - 12} fontSize="9" fill="#8A8B8B" textAnchor="middle">{fD(p.ts)}</text>))}
      <polyline points={line("ejec")} fill="none" stroke="#2C4E8A" strokeWidth="2.6" strokeLinejoin="round" />
      <polyline points={line("cobr")} fill="none" stroke="#2E7D4F" strokeWidth="2.6" strokeLinejoin="round" />
      <polyline points={line("pag")} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" />
      {S.map((p, i) => (<g key={"pt" + i}><circle cx={x(p.ts)} cy={y(p.ejec)} r="3" fill="#2C4E8A" /><circle cx={x(p.ts)} cy={y(p.cobr)} r="3" fill="#2E7D4F" /><circle cx={x(p.ts)} cy={y(p.pag)} r="3" fill="var(--accent)" /></g>))}
      <g transform={`translate(${ml + 4},${mt - 4})`}>
        <line x1="0" y1="-3" x2="18" y2="-3" stroke="#2C4E8A" strokeWidth="2.6" /><text x="23" y="0" fontSize="9.5" fill="#5B5C5C">Ejecutado (valorizado)</text>
        <line x1="150" y1="-3" x2="168" y2="-3" stroke="#2E7D4F" strokeWidth="2.6" /><text x="173" y="0" fontSize="9.5" fill="#5B5C5C">Cobrado</text>
        <line x1="240" y1="-3" x2="258" y2="-3" stroke="var(--accent)" strokeWidth="2.6" /><text x="263" y="0" fontSize="9.5" fill="#5B5C5C">Pagado</text>
      </g>
    </svg>
    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: delta >= -0.005 ? "var(--good)" : "var(--warn)" }}>
      {delta >= -0.005
        ? `Vas cobrando por delante de lo ejecutado: ${sym} ${fmt(delta / rate)} a favor de tu caja.`
        : `Estás ejecutando más de lo que has cobrado: ${sym} ${fmt(-delta / rate)} financiados por la empresa.`}
    </div>
  </div>);
}
function printClean(title) {
  if (typeof document === "undefined") return;
  const el = document.querySelector(".app .client") || document.querySelector(".app .report");
  if (!el) { window.print(); return; }
  const css = (typeof CSS === "string" && CSS) ? CSS : ((document.querySelector("style") || {}).textContent || "");
  const prev = document.querySelector("#og-print-frame"); if (prev) prev.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "og-print-frame";
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title || "Documento"}</title><style>${css}\n@page{margin:14mm}html,body{background:#fff;margin:0;padding:0}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}.app{max-width:820px;margin:0 auto;padding:8px}.no-print{display:none !important}</style></head><body><div class="app">${el.outerHTML}</div></body></html>`);
  doc.close();
  const go = () => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { try { window.print(); } catch {} } setTimeout(() => { try { iframe.remove(); } catch {} }, 1500); };
  setTimeout(go, 450);
}
const inSandbox = () => { try { return window.self !== window.top; } catch { return true; } };
function loadScript(src) { return new Promise((res) => { try { if ([...document.scripts].some((s) => s.src === src)) return res(true); const s = document.createElement("script"); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); } catch { res(false); } }); }
async function ensureCanvasLib() { if (!window.html2canvas) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"); return !!window.html2canvas; }
async function exportImagen(title) {
  const el = document.querySelector(".app .client") || document.querySelector(".app .report");
  if (!el) return false;
  if (!(await ensureCanvasLib())) return false;
  try { const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true }); const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = (title || "Documento") + ".png"; document.body.appendChild(a); a.click(); a.remove(); return true; } catch { return false; }
}
async function exportPDFdownload(title) {
  const el = document.querySelector(".app .client") || document.querySelector(".app .report");
  if (!el) return false;
  if (!(await ensureCanvasLib())) return false;
  if (!window.jspdf) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  if (!window.jspdf) return false;
  try {
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const img = canvas.toDataURL("image/jpeg", 0.94);
    const { jsPDF } = window.jspdf; const pdf = new jsPDF("p", "mm", "letter");
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const mx = 12, mtop = 12, mbot = 14;
    const iw = pw - mx * 2, ih = canvas.height * iw / canvas.width;
    const pageH = ph - mtop - mbot;
    let hLeft = ih, pos = mtop;
    pdf.addImage(img, "JPEG", mx, pos, iw, ih); hLeft -= pageH;
    while (hLeft > 0) { pdf.addPage(); pos = mtop - (ih - hLeft); pdf.addImage(img, "JPEG", mx, pos, iw, ih); hLeft -= pageH; }
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFillColor(255, 255, 255); pdf.rect(0, ph - mbot, pw, mbot, "F");
      if (i > 1) pdf.rect(0, 0, pw, mtop, "F");
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(140, 140, 140);
      pdf.text(i + "/" + total, pw - mx, ph - 5, { align: "right" });
    }
    pdf.save((title || "Documento") + ".pdf"); return true;
  } catch { return false; }
}
async function emitPDF(title) {
  const ok = await exportPDFdownload(title);
  if (!ok) { try { const p = document.title; if (title) document.title = title; window.print(); setTimeout(() => { try { document.title = p; } catch {} }, 900); } catch {} }
  return ok;
}
async function smartPDF(title) {
  if (!inSandbox()) {
    const prevT = document.title;
    try { if (title) document.title = title; window.print(); } catch { printClean(title); }
    setTimeout(() => { try { document.title = prevT; } catch {} }, 900);
    return true;
  }
  const ok = await exportPDFdownload(title);
  if (!ok) printClean(title);
  return ok;
}
const TYPICAL = () => [
  { id: uid(), nombre: "Anticipo", pct: 20, pagado: false, fecha: "", montoPagado: "" },
  { id: uid(), nombre: "Avance 1", pct: 30, pagado: false, fecha: "", montoPagado: "" },
  { id: uid(), nombre: "Avance 2", pct: 30, pagado: false, fecha: "", montoPagado: "" },
  { id: uid(), nombre: "Saldo", pct: 20, pagado: false, fecha: "", montoPagado: "" },
];
const newItem = (p) => ({ id: uid(), descripcion: "", unidad: "m2", cantidad: "", puDirecto: "", puMoneda: "Bs", puTC: "", ggPct: p.ggDefault, utilPct: p.utilDefault });
const STARTER = () => ({
  meta: { codigo: "OCS_CON_001_" + yy(), version: 1, cliente: "", proyecto: "", ubicacion: "", superficie: "", fecha: today(), moneda: "Bs", plazoEjecucion: "", grupoALabel: "Arquitectura", grupoBLabel: "Ingenierías", grupoCLabel: "Terceros (contratación directa)", estado: "Cotizada", servicio: "obra", pagos: [], precioCierre: "", cierreModo: "visible", logo: "" },
  params: { ...DEFAULT_PARAMS }, contractors: {},
  sections: [
    { id: uid(), nombre: "Preparación del sitio", grupo: "A", items: [{ id: uid(), descripcion: "Replanteo general de obras internas", unidad: "m2", cantidad: "111", puDirecto: "8", ggPct: 8, utilPct: 15 }] },
    { id: uid(), nombre: "Construcción en seco", grupo: "A", items: [{ id: uid(), descripcion: "Provisión y montaje de cielo falso estándar", unidad: "m2", cantidad: "51", puDirecto: "144.31", ggPct: 8, utilPct: 15 }] },
  ],
});
const TEAM_MAILS = ["jvacadiez@origina-group.com", "fbaldivieso@origina-group.com", "pleigue@origina-group.com", "vdorado@origina-group.com", "administracion@origina-group.com"];
const guessMail = (nombre) => { const n = norm(nombre || ""); const m = { "juan": "jvacadiez", "fernanda": "fbaldivieso", "paula": "pleigue", "valeria": "vdorado", "yanine": "administracion", "janine": "administracion" }; const k = Object.keys(m).find((x) => n.includes(x)); return k ? m[k] + "@origina-group.com" : ""; };
const UNITS = ["m2", "ml", "m", "m3", "pza", "pto", "u", "jgo", "glb", "gbl", "kg", "bolsa", "día", "mes", "hr", "viajes", "%"];
const CATALOGO_BASE = [
  { nombre: "PREPARACIÓN DEL SITIO", items: [
    { descripcion: "Replanteo General de Obras Internas", unidad: "m2", pu: 8 },
    { descripcion: "Transporte de equipos, herramientas y materiales de obra", unidad: "viajes", pu: 700 },
  ]},
  { nombre: "DESMONTAJES Y DESARMADOS", items: [
    { descripcion: "Desmontaje/Montaje de Cielo Falso Desmontable", unidad: "m2", pu: 70 },
    { descripcion: "Cortes en muro p/Paso de Instalaciones", unidad: "pza", pu: 100 },
  ]},
  { nombre: "CONSTRUCCIÓN EN SECO", items: [
    { descripcion: "Provisión de Material y Montaje de Cielo Falso Estándar h = 2,50m", unidad: "m2", pu: 160 },
    { descripcion: "Registros 60x60cm", unidad: "pza", pu: 120 },
    { descripcion: "M01 - Muro Dry-Wall Estándar (Estructura c/40cm + Placa 10mm c/lado) h = Cielo Falso", unidad: "m2", pu: 360 },
    { descripcion: "M02 - Muro Dry-Wall Acústico (Estructura c/40cm + Placa 12mm c/lado + Lana de Vidrio) h = Losa Existente", unidad: "m2", pu: 360 },
    { descripcion: "Perforaciones para Difusores de Climatización", unidad: "pto", pu: 80 },
    { descripcion: "D02 - Dintel Acústico (Incluye Lana de Vidrio)", unidad: "ml", pu: 240 },
    { descripcion: "Refuerzos en Muros Dry-Wall (para Televisores)", unidad: "pza", pu: 120 },
    { descripcion: "Buña en Muro", unidad: "ml", pu: 30 },
    { descripcion: "Tapado de Huecos y/o Perforaciones para Paso de Instalaciones en Cielorrasos", unidad: "pto", pu: 80 },
    { descripcion: "Instalación de Televisor", unidad: "pza", pu: 150 },
  ]},
  { nombre: "PISO TÉCNICO", items: [
    { descripcion: "Levantado de piso técnico para ducteado y cableado de las instalaciones", unidad: "glb", pu: 950 },
  ]},
  { nombre: "PINTURA", items: [
    { descripcion: "Pintura Látex Blanca en Cielo Falso", unidad: "m2", pu: 28 },
    { descripcion: "Pintura Látex Color Blanco en Muros", unidad: "m2", pu: 28 },
    { descripcion: "Pintura Látex de Color en Muros", unidad: "m2", pu: 35 },
    { descripcion: "Desmanches y retoques finales", unidad: "glb", pu: 1200 },
  ]},
  { nombre: "CARPINTERÍA DE ALUMINIO Y VIDRIO", items: [
    { descripcion: "Mampara de Aluminio y Vidrio Laminado Inocoloro 4+4mm VASA + Chapas + Bisagras + Topes (Gerencia General)", unidad: "m2", pu: 1785 },
    { descripcion: "Mampara de Aluminio y Vidrio Laminado Inocoloro 4+4mm VASA + Chapas + Bisagras + Topes (Gerente Adm)", unidad: "m2", pu: 1700 },
    { descripcion: "Mampara de Aluminio y Vidrio Laminado Inocoloro 4+4mm VASA + Chapas + Bisagras + Topes (Sala de Reuniones)", unidad: "m2", pu: 1700 },
    { descripcion: "Puerta de Aluminio y Vidrio Laminado Inocoloro 4+4mm VASA + Chapas + Bisagras + Topes (Phone Booth)", unidad: "pza", pu: 7640 },
    { descripcion: "Paño fijo divisorio entre Gerencias", unidad: "m2", pu: 1700 },
    { descripcion: "Puerta de dos hojas para ingreso principal Vidrio Incoloro 10mm VASA + Chapas + Bisagras + Topes + Frenos", unidad: "pza", pu: 14500 },
    { descripcion: "Zócalos de Aluminio Nuevos (h=11cm)", unidad: "ml", pu: 150 },
  ]},
  { nombre: "MOBILIARIO A MEDIDA", items: [
    { descripcion: "Mesa de Phone Booth", unidad: "pza", pu: 1650 },
    { descripcion: "Mesada tipo mesón para comedor en Melamina 18mm", unidad: "pza", pu: 4600 },
    { descripcion: "Puerta plegable UL", unidad: "pza", pu: 6200 },
  ]},
  { nombre: "LUMINARIAS", items: [
    { descripcion: "Luminaria Colgante Lineal Led 40w (Luz Cálida)", unidad: "pza", pu: 1000 },
    { descripcion: "Spot de Interior de Empotrar Circular 10w", unidad: "pza", pu: 150 },
  ]},
  { nombre: "TRABAJOS METÁLICOS", items: [
    { descripcion: "Patas metálicas para mesada de comedor", unidad: "pza", pu: 2600 },
    { descripcion: "Enchape metálico tipo calamina pintado color naranja. Instalado en el frente de la recepción.", unidad: "m2", pu: 1000 },
  ]},
  { nombre: "CORTINAS", items: [
    { descripcion: "Cortinas Roller Screen Manual 3% h = Piso a Techo (toda la fachada)", unidad: "m2", pu: 270 },
    { descripcion: "Cortinas Roller Screen 1% Automático h = Piso a Techo (Sala de Reuniones)", unidad: "m2", pu: 470 },
  ]},
  { nombre: "BRANDING", items: [
    { descripcion: "Letrero MDF pintado ´´HAPAG-LLOYD´´ (no incluye iluminación)", unidad: "pza", pu: 1800 },
    { descripcion: "Nombres en Acrílico de 5mm y Frente de Acrílico 3mm (Sala de Reuniones, GG, G.ADM, PHONE BOOTH) Obs: pendiente de coordinación con Área de Marketing", unidad: "pza", pu: 400 },
    { descripcion: "Esmerilado en Vidrios", unidad: "glb", pu: 2100 },
    { descripcion: "Adhesivos y pintura para manejo de marca en pared lateral ingreso", unidad: "glb", pu: 2150 },
    { descripcion: "Cuadros para impresión en FOAM + Vinilico con imágenes corporativas de 1.40x0.80m", unidad: "pza", pu: 600 },
  ]},
  { nombre: "VEGETACIÓN Y PAISAJISMO", items: [
    { descripcion: "Vegetación, Mano de Obra, Sustratos y Transporte", unidad: "glb", pu: 1500 },
    { descripcion: "Maceteros plásticos medianos", unidad: "pza", pu: 600 },
  ]},
  { nombre: "ACONDICIONAMIENTO ACÚSTICO", items: [
    { descripcion: "Revestimiento en Muro (Phone Booth)", unidad: "m2", pu: 950 },
  ]},
  { nombre: "COORDINACIÓN DE MOBILIARIO", items: [
    { descripcion: "Coordinación de Mobiliario con proveedor seleccionado por el cliente.", unidad: "glb", pu: 9500 },
  ]},
  { nombre: "FINALIZACIÓN DE OBRA", items: [
    { descripcion: "Limpieza General de Obra (Incluye Previo Desempolvado para Ingreso de Muebles y Alfombra)", unidad: "m2", pu: 20 },
    { descripcion: "Retiro de Escombros y basura", unidad: "viajes", pu: 700 },
  ]},
  { nombre: "ROCIADORES AUTOMÁTICOS", items: [
    { descripcion: "Modificación del Sistema de Combate Contra Incendios", unidad: "glb", pu: 12500 },
  ]},
  { nombre: "INSTALACIÓN ELÉCTRICA", items: [
    { descripcion: "Provisión e Instalación Punto de Iluminación", unidad: "pza", pu: 214.87 },
    { descripcion: "Provisión e Instalación Punto de Tomacorriente (Incluye Placa eléctrica)", unidad: "pza", pu: 258.21 },
    { descripcion: "Provisión e Instalación Punto de Cortina", unidad: "mts", pu: 338.62 },
    { descripcion: "Provisión e Instalación punto de interruptor (incluye placa interruptor)", unidad: "mts", pu: 158.78 },
    { descripcion: "Provisión e Instalación Componentes en tablero existente", unidad: "mts", pu: 1793.09 },
    { descripcion: "Instalación de Luminarias", unidad: "mts", pu: 38.43 },
    { descripcion: "Instalación de Placas Tomacorrientes e Interruptores", unidad: "pza", pu: 31.88 },
    { descripcion: "Traslado Punto Fan Coil", unidad: "pto", pu: 798 },
    { descripcion: "Traslado Punto Termostato", unidad: "pto", pu: 1178 },
  ]},
  { nombre: "INSTALACIÓN DE CLIMATIZACIÓN", items: [
    { descripcion: "Equipos Fan-Coils Para Aire Acondicioado — Instalación y puesta en marcha de Fan Coils", unidad: "equipo", pu: 1042.4 },
    { descripcion: "Equipos Fan-Coils Para Aire Acondicioado — Desinstalación de Fan Coils", unidad: "equipo", pu: 378 },
    { descripcion: "Valvulas y Termostatos — Desintalacion de Valvulas de control de FC", unidad: "pza", pu: 94.5 },
    { descripcion: "Valvulas y Termostatos — Instalacion de Valvulas de control de FC", unidad: "pza", pu: 123.69 },
    { descripcion: "Tuberías De Polipropileno Termosoldadas y Accesorios — Tuberías de agua fría PP y PN20 DN 40 c/Aislamiento neopreno e=19 mm 1 5/8\"", unidad: "m", pu: 195.37 },
    { descripcion: "Tuberías De Polipropileno Termosoldadas y Accesorios — Accesorios para tubería de polipropileno", unidad: "gbl", pu: 689.14 },
    { descripcion: "Tuberías De Cobre y Cableado De Interconexión — Movimiento de termostatos existentes + cableado", unidad: "pto", pu: 189 },
    { descripcion: "Tuberías De Condensado — Tuberías de condensados SCH-40 3/4\" c/Aislamiento de neopreno", unidad: "m", pu: 71.88 },
    { descripcion: "Tuberías De Condensado — Accesorios tubería de condensados", unidad: "glb", pu: 152.8 },
    { descripcion: "Conductos De Aire — Conductos de acero galvanizado + montaje", unidad: "m2", pu: 247.09 },
    { descripcion: "Conductos De Aire — Desmontaje y acondicionamiento de ductos existentes", unidad: "m2", pu: 330.75 },
    { descripcion: "Conductos De Aire — Conductos Flexibles 10\"", unidad: "m", pu: 246.24 },
    { descripcion: "Conductos De Aire — Movimiento de ductos con cajas", unidad: "pza", pu: 964.14 },
    { descripcion: "Conductos De Aire — Montaje de plenum", unidad: "pza", pu: 109.92 },
    { descripcion: "Conductos De Aire — Adecuaciones de ductos para Flexibles", unidad: "glb", pu: 254.4 },
    { descripcion: "Difusores Para Inyeccion De Aire — Suministro y Montaje de rejillas cuadradas", unidad: "pza", pu: 800.4 },
    { descripcion: "Difusores Para Inyeccion De Aire — Desmontaje y montaje de rejillas cuadradas.", unidad: "pza", pu: 94.5 },
    { descripcion: "Rejillas Para Aire De Retorno — Suministro y Montaje Rejilla de retorno 600x600", unidad: "pza", pu: 576.25 },
    { descripcion: "Soportería Para Equipos Conductos y Tuberías — Soportes para tuberías y conductos de ventilación", unidad: "glb", pu: 501.15 },
  ]},
  { nombre: "INSTALACIONES DE REDES, CCTV Y ACCESO", items: [
    { descripcion: "Instalación de Gabinete y accesorios provisto por el cliente", unidad: "pza", pu: 670 },
    { descripcion: "Provisión e Instalación Punto de cable UTP Cat6 100% cobre incluye Ducteado PVC + Cajas + Materiales Menores", unidad: "pto", pu: 745 },
    { descripcion: "Patch Cords (ambas puntas), Patch Panel y Accesorios en CAT6", unidad: "pto", pu: 348 },
    { descripcion: "Provisión e Instalación de Access Point Ubiquiti WiFi6 modelo U6+", unidad: "pza", pu: 2530 },
    { descripcion: "Cableado para control de Acceso, y accesorios Chapa y Botón", unidad: "puertas", pu: 2420 },
    { descripcion: "Control de Acceso y Asistencia Facial, PIN, Huella y tarjeta ZKteco modelo SenseFace 2A para puerta principal", unidad: "pza", pu: 1718 },
    { descripcion: "Cerradura Smart para puerta del rack", unidad: "pza", pu: 1462 },
    { descripcion: "HDMI cableado y ducteado para equipo de video conferencia del cliente.", unidad: "glb", pu: 1360 },
    { descripcion: "Grabador NVR 4ch PoE con Disco de 2TB Marca: DAHUA", unidad: "pza", pu: 2748 },
    { descripcion: "Cámara Domo IP de 2mpx con Audio Marca: DAHUA", unidad: "pza", pu: 662 },
  ]},
  { nombre: "SENSORES DE HUMO", items: [
    { descripcion: "Detector Photo", unidad: "pza", pu: 1452.91 },
    { descripcion: "Base para detector", unidad: "pza", pu: 246.72 },
    { descripcion: "Cable 2x18", unidad: "m", pu: 10.75 },
    { descripcion: "Ferretería (cajas octogonal, tapas, flexible, tarugos, conefctores, tornillos, abrazaderas)", unidad: "glb", pu: 1075.32 },
    { descripcion: "Instalación de 2 detectores + Configuración en panel", unidad: "glb", pu: 1243.38 },
  ]},
];
const CATALOGO_COUNT = CATALOGO_BASE.reduce((a, c) => a + c.items.length, 0);
const SEED_LIB = () => [
  { id: uid(), nombre: "ELÉCTRICO", items: [
    { id: uid(), descripcion: "Tomacorriente normal", unidad: "pto", puDirecto: "" },
    { id: uid(), descripcion: "Tomacorriente doble", unidad: "pto", puDirecto: "" },
    { id: uid(), descripcion: "Punto de luz / luminaria", unidad: "pto", puDirecto: "" },
    { id: uid(), descripcion: "Interruptor simple", unidad: "pto", puDirecto: "" },
    { id: uid(), descripcion: "Tablero de distribución", unidad: "pza", puDirecto: "" },
  ]},
  { id: uid(), nombre: "HIDROSANITARIO", items: [
    { id: uid(), descripcion: "Punto de agua fría", unidad: "pto", puDirecto: "" },
    { id: uid(), descripcion: "Punto de agua caliente", unidad: "pto", puDirecto: "" },
    { id: uid(), descripcion: "Punto de desagüe", unidad: "pto", puDirecto: "" },
    { id: uid(), descripcion: "Bajante pluvial", unidad: "ml", puDirecto: "" },
  ]},
  { id: uid(), nombre: "CONSTRUCCIÓN EN SECO", items: [
    { id: uid(), descripcion: "Muro drywall estándar (placa 12mm c/lado)", unidad: "m2", puDirecto: "" },
    { id: uid(), descripcion: "Muro drywall acústico (con lana de vidrio)", unidad: "m2", puDirecto: "" },
    { id: uid(), descripcion: "Cielo falso estándar h=2.50", unidad: "m2", puDirecto: "" },
  ]},
  { id: uid(), nombre: "PINTURA Y ACABADOS", items: [
    { id: uid(), descripcion: "Pintura látex 2 manos", unidad: "m2", puDirecto: "" },
    { id: uid(), descripcion: "Empaste y lijado", unidad: "m2", puDirecto: "" },
  ]},
];

/* ============================== STORAGE ============================== */
/* Storage: works in Claude (window.storage) AND deployed on Synology (PHP API + localStorage for drafts).
   When served from the NAS, index.html defines window.OG_API (+ window.OG_TOKEN). */
const OG_API = (typeof window !== "undefined" && window.OG_API) ? window.OG_API : null;
const hasStore = () => !!OG_API || (typeof window !== "undefined" && !!window.storage);
const isSharedKey = (k) => k !== "quote_draft" && k !== "design_draft";
// ---- offline support (deployed mode): local cache mirror + pending write queue ----
let ogOnline = true; const ogListeners = new Set();
const ogSubscribe = (f) => { ogListeners.add(f); return () => ogListeners.delete(f); };
const setOnline = (v) => { if (ogOnline !== v) { ogOnline = v; ogListeners.forEach((f) => { try { f(v); } catch {} }); } };
const ogIsOnline = () => ogOnline;
const cacheGet = (k) => { try { const v = localStorage.getItem("ogc_" + k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } };
const cacheSet = (k, v) => { try { localStorage.setItem("ogc_" + k, JSON.stringify(v)); } catch {} };
const cacheDel = (k) => { try { localStorage.removeItem("ogc_" + k); } catch {} };
const pendKeys = () => { try { return JSON.parse(localStorage.getItem("og_pending") || "[]"); } catch { return []; } };
const setPend = (a) => { try { localStorage.setItem("og_pending", JSON.stringify(a)); } catch {} };
const addPend = (k) => { const s = new Set(pendKeys()); s.add(k); setPend([...s]); };
async function apiCall(op, payload) {
  const r = await fetch(OG_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, token: (typeof window !== "undefined" && window.OG_TOKEN) || "", ...payload }) });
  if (!r.ok) throw new Error("api " + r.status);
  return r.json();
}
async function ogPing() { if (!OG_API) return true; try { await apiCall("get", { key: "__ping__" }); setOnline(true); return true; } catch { setOnline(false); return false; } }
async function syncPending() {
  if (!OG_API) return { done: 0, fail: 0 };
  const keys = pendKeys(); if (!keys.length) return { done: 0, fail: 0 };
  let done = 0; const remaining = [];
  for (const k of keys) { const val = cacheGet(k); try { if (val === undefined) await apiCall("delete", { key: k }); else await apiCall("set", { key: k, value: val }); done++; } catch { remaining.push(k); } }
  setPend(remaining); setOnline(remaining.length === 0);
  return { done, fail: remaining.length };
}
async function rawGet(k, shared) {
  if (OG_API) {
    if (shared) { try { const d = await apiCall("get", { key: k }); setOnline(true); const val = d && d.value != null ? d.value : null; cacheSet(k, val); return val; } catch { setOnline(false); const c = cacheGet(k); return c === undefined ? null : c; } }
    try { const v = localStorage.getItem("og_" + k); return v ? JSON.parse(v) : null; } catch { return null; }
  }
  if (!window.storage) return null;
  try { const r = await window.storage.get(k, shared); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function rawSet(k, v, shared) {
  if (OG_API) {
    if (shared) { cacheSet(k, v); try { await apiCall("set", { key: k, value: v }); setOnline(true); } catch { setOnline(false); addPend(k); } return; }
    try { localStorage.setItem("og_" + k, JSON.stringify(v)); } catch {}
    return;
  }
  if (window.storage) { try { await window.storage.set(k, JSON.stringify(v), shared); } catch {} }
}
async function rawDel(k, shared) {
  if (OG_API) {
    if (shared) { cacheDel(k); try { await apiCall("delete", { key: k }); setOnline(true); } catch { setOnline(false); addPend(k); } return; }
    try { localStorage.removeItem("og_" + k); } catch {}
    return;
  }
  if (window.storage) { try { await window.storage.delete(k, shared); } catch {} }
}
async function sGet(k) { return rawGet(k, isSharedKey(k)); }
async function sSet(k, v) { return rawSet(k, v, isSharedKey(k)); }
async function migrateShared() {
  if (!hasStore()) return;
  try {
    const done = await rawGet("og_migrated", true); if (done) return;
    const copy = async (k) => { const sh = await rawGet(k, true); const pe = await rawGet(k, false); if ((sh == null || (Array.isArray(sh) && !sh.length)) && pe != null) await rawSet(k, pe, true); };
    for (const k of ["og_users", "og_correlativo", "og_correlativo_dis", "og_correlativo_it", "lib_costs", "lib_contractors", "lib_ordenes", "og_design_params"]) await copy(k);
    const idxSh = await rawGet("quotes_index", true);
    if (!idxSh || !idxSh.length) { const idxP = (await rawGet("quotes_index", false)) || []; for (const rec of idxP) { const q = await rawGet("quote_" + rec.id, false); if (q) await rawSet("quote_" + rec.id, q, true); } if (idxP.length) await rawSet("quotes_index", idxP, true); }
    await rawSet("og_migrated", true, true);
  } catch {}
}
async function fetchTCOficial(force) {
  // En el NAS: lo trae api.php (el navegador no puede leer bcb.gob.bo por seguridad entre dominios)
  if (OG_API) { try { const d = await apiCall("tc", force ? { force: 1 } : {}); return d && d.tc ? d.tc : null; } catch { return null; } }
  // Fuera del NAS (modo prueba): intenta la API pública directamente
  try { const r = await fetch("https://apibcb.cucu.bo/api/v1/tc/oficial"); if (!r.ok) return null; const d = await r.json(); const t = d && d.tc_oficial; return t ? { valor: t.compra, venta: t.venta, fecha: t.fecha, fuente: t.fuente || "BCB" } : null; } catch { return null; }
}
const LOCK_TTL = 90000;
async function readLock(id) { return rawGet("lock_" + id, true); }
async function writeLock(id, user) { await rawSet("lock_" + id, { user: user.id, name: user.nombre, ts: Date.now() }, true); }
async function clearLock(id) { await rawDel("lock_" + id, true); }

/* ============================== APP ============================== */
/* ============================== USERS & ROLES ============================== */
const ROLES = {
  CEO: { label: "CEO", desc: "Edición y configuración · acceso total", color: "var(--accent)", chip: "rc-ceo", perms: { edit: true, config: true, cotizacion: true, ejecutivo: true, interno: true, proveedores: true, backup: true, usuarios: true, consultaObra: true, consultaDiseno: true } },
  COLAB: { label: "Colaborador", desc: "Cotiza, proveedores, OCs y seguimiento", color: "var(--ink)", chip: "rc-colab", perms: { edit: true, config: false, cotizacion: true, ejecutivo: false, interno: true, proveedores: true, backup: true, usuarios: false, consultaObra: true, consultaDiseno: false } },
  VISOR: { label: "Visualizador", desc: "Solo consulta y extracción de datos", color: "#8A6D3B", chip: "rc-visor", perms: { edit: false, config: false, cotizacion: false, ejecutivo: true, interno: true, proveedores: false, backup: true, usuarios: false, consultaObra: true, consultaDiseno: true } },
};
const PERM_LABELS = { edit: "Cotizar / editar", cotizacion: "Parámetros de cotización", config: "Configuración del modelo", ejecutivo: "Informes ejecutivos", interno: "Control interno / OCs", proveedores: "Proveedores / precios", backup: "Respaldo", usuarios: "Gestión de usuarios", consultaObra: "Consultar OBRA", consultaDiseno: "Consultar PROYECTOS" };
const permsOf = (u) => (u && u.perms) ? u.perms : (u ? ROLES[u.rol].perms : ROLES.VISOR.perms);
const initials = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function UsersModal({ users, onSave, onClose }) {
  const [list, setList] = useState(users.map((u) => ({ ...u, perms: { ...permsOf(u) } })));
  const upd = (id, patch) => setList((l) => l.map((u) => u.id === id ? { ...u, ...patch } : u));
  const setRole = (id, rol) => setList((l) => l.map((u) => u.id === id ? { ...u, rol, perms: { ...ROLES[rol].perms } } : u));
  const togglePerm = (id, k) => setList((l) => l.map((u) => u.id === id ? { ...u, perms: { ...u.perms, [k]: !u.perms[k] } } : u));
  const add = () => setList((l) => [...l, { id: uid(), nombre: "", apellidos: "", cargo: "", email: "", firma: "", rol: "COLAB", perms: { ...ROLES.COLAB.perms }, pin: "" }]);
  const del = (id) => { if (list.length <= 1) return; if (confirm("¿Eliminar este usuario?")) setList((l) => l.filter((u) => u.id !== id)); };
  const save = () => { const clean = list.filter((u) => (u.nombre || "").trim()); if (!clean.some((u) => u.rol === "CEO")) { alert("Debe existir al menos un usuario CEO."); return; } onSave(clean); onClose(); };
  const firmaInput = useRef(null); const firmaFor = useRef(null);
  const onFirmaFile = (file) => {
    const id = firmaFor.current; if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = (e) => { const img = new Image(); img.onload = () => { const max = 520, sc = Math.min(1, max / img.width); const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); upd(id, { firma: cv.toDataURL("image/png") }); }; img.src = e.target.result; };
    reader.readAsDataURL(file);
  };
  return (<Scrim onClose={onClose}>
    <div className="modal-h"><h3><Users size={17} /> Usuarios y permisos</h3><button className="iconbtn" onClick={onClose}><X size={18} /></button></div>
    <datalist id="og-mails">{TEAM_MAILS.map((m) => <option key={m} value={m} />)}</datalist>
    <input ref={firmaInput} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => { onFirmaFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
    <div style={{ padding: 16, maxHeight: "72vh", overflowY: "auto" }}>
      {list.map((u) => (<div className="umodal-row" key={u.id}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <span className="ub-av" style={{ background: ROLES[u.rol].color }}>{initials(u.nombre) || "?"}</span>
          <input className="fld" style={{ flex: 1, minWidth: 90 }} value={u.nombre} placeholder="Nombre(s)" onChange={(e) => upd(u.id, { nombre: e.target.value })} />
          <input className="fld" style={{ flex: 1, minWidth: 90 }} value={u.apellidos || ""} placeholder="Apellidos" onChange={(e) => upd(u.id, { apellidos: e.target.value })} />
          <select className="psel" value={u.rol} onChange={(e) => setRole(u.id, e.target.value)}>{Object.keys(ROLES).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select>
          <button className="iconbtn" onClick={() => del(u.id)}><Trash2 size={15} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", flexWrap: "wrap" }}>
          <input className="fld" style={{ flex: 1, minWidth: 130 }} value={u.cargo || ""} placeholder="Cargo (ej. Gerente General)" onChange={(e) => upd(u.id, { cargo: e.target.value })} />
          <input className="fld" style={{ flex: 1, minWidth: 150 }} list="og-mails" value={u.email || ""} placeholder="correo@origina-group.com" onChange={(e) => upd(u.id, { email: e.target.value })} />
          {!u.email && guessMail(u.nombre) && <button className="btn sm" title="Usar el correo del equipo" onClick={() => upd(u.id, { email: guessMail(u.nombre) })}>Sugerir</button>}
          <input className="fld num" style={{ width: 120 }} inputMode="numeric" value={u.pin || ""} placeholder="PIN (opcional)" onChange={(e) => upd(u.id, { pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
          {u.firma ? <img src={u.firma} alt="firma" style={{ height: 40, background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: 3 }} /> : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Sin firma cargada</span>}
          <button className="btn sm" onClick={() => { firmaFor.current = u.id; firmaInput.current && firmaInput.current.click(); }}><PackagePlus size={13} /> {u.firma ? "Cambiar firma" : "Cargar firma (PNG)"}</button>
          {u.firma && <button className="btn sm ghost" onClick={() => upd(u.id, { firma: "" })}>Quitar</button>}
        </div>
        <div className="perm-grid">
          {Object.keys(PERM_LABELS).map((k) => (<button key={k} className={"perm-tog" + (u.perms[k] ? " on" : "")} onClick={() => togglePerm(u.id, k)}>{PERM_LABELS[k]}</button>))}
        </div>
      </div>))}
      <button className="btn sm" onClick={add}><Plus size={13} /> Agregar usuario</button>
      <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={save}><Save size={15} /> Guardar cambios</button>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>El nombre completo, cargo y correo aparecen en la firma de los documentos (OCs, ofertas, informes). La firma en PNG (idealmente fondo transparente) se estampa sobre la línea de firma. El PIN protege el acceso a ese usuario.</p>
    </div>
  </Scrim>);
}

function Welcome({ users, onPick }) {
  const [pinFor, setPinFor] = useState(null); const [pin, setPin] = useState("");
  const [err, setErr] = useState(false); const flashPin = () => { setErr(true); setTimeout(() => setErr(false), 1200); };
  const [remember, setRemember] = useState({}); const [remChk, setRemChk] = useState(true); const [forgot, setForgot] = useState(false);
  useEffect(() => { (async () => { const m = {}; for (const u of users) { if (u.pin) { const v = await rawGet("og_remember_" + u.id, false); if (v) m[u.id] = v; } } setRemember(m); })(); }, [users]);
  const tryPick = (u) => { if (u.pin) { if (remember[u.id] === u.pin) { onPick(u); return; } setPinFor(u); setPin(""); setForgot(false); setRemChk(true); } else onPick(u); };
  const submitPin = async () => { if (pinFor && pin === pinFor.pin) { if (remChk) await rawSet("og_remember_" + pinFor.id, pinFor.pin, false); else await rawDel("og_remember_" + pinFor.id, false); onPick(pinFor); setPinFor(null); } else flashPin(); };
  return (<div className="gate"><style>{CSS}</style><div className="gate-card">
    <img className="gate-logo" src={DEFAULT_LOGO} alt="ORIGINA" />
    {!pinFor ? (<>
      <h2 className="gate-h">Bienvenido a ORIGINA</h2>
      <p className="gate-sub">Sistema de cotización y gestión de obra. Selecciona tu usuario para continuar.</p>
      {users.map((u) => { const r = ROLES[u.rol]; return (<button className="user-card" key={u.id} onClick={() => tryPick(u)}>
        <span className="user-av" style={{ background: r.color }}>{initials(u.nombre)}</span>
        <span><span className="un">{u.nombre}{u.pin ? (remember[u.id] === u.pin ? " ✓" : " 🔒") : ""}</span><span className="ur">{r.desc}</span></span>
        <span className={"rolechip " + r.chip}>{r.label}</span>
      </button>); })}
    </>) : forgot ? (<>
      <h2 className="gate-h">¿Olvidaste tu PIN?</h2>
      <p className="gate-sub">Por seguridad, los PIN no se muestran ni se envían. Pídele al <b>CEO / administrador</b> que lo restablezca:</p>
      <div className="note" style={{ marginBottom: 14 }}>El administrador entra a <b>Usuarios</b>, ubica a <b>{pinFor.nombre}</b>, borra o cambia el PIN y guarda. Luego podrás ingresar con el nuevo PIN (o sin PIN si lo deja vacío).</div>
      <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setForgot(false)}>Volver</button>
    </>) : (<>
      <h2 className="gate-h">PIN de acceso</h2>
      <p className="gate-sub">Ingresa el PIN de <b>{pinFor.nombre}</b> ({ROLES[pinFor.rol].label}).</p>
      <input className="fld num" style={{ width: "100%", fontSize: 20, letterSpacing: 6, textAlign: "center", borderColor: err ? "var(--bad)" : undefined }} type="password" inputMode="numeric" value={pin} autoFocus placeholder="••••" onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitPin()} />
      {err && <div style={{ color: "var(--bad)", fontSize: 12, marginTop: 6 }}>PIN incorrecto</div>}
      <label className="ab-toggle" style={{ marginTop: 12 }} onClick={() => setRemChk((v) => !v)}><span className={"ab-sw" + (remChk ? " on" : "")} /><span>Recordarme en este dispositivo</span></label>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn" onClick={() => setPinFor(null)}>Volver</button>
        <button className="btn primary" style={{ flex: 1, justifyContent: "center" }} onClick={submitPin}>Entrar</button>
      </div>
      <div style={{ textAlign: "center", marginTop: 12 }}><button className="gate-link" onClick={() => setForgot(true)}>¿Olvidaste tu PIN?</button></div>
    </>)}
  </div></div>);
}

function ServiceType({ user, onPick, onChangeUser }) {
  const p = permsOf(user); const canConsult = p.consultaObra || p.consultaDiseno;
  return (<div className="gate"><style>{CSS}</style><div className="gate-card">
    <img className="gate-logo" src={DEFAULT_LOGO} alt="ORIGINA" />
    <h2 className="gate-h">¿Qué deseas cotizar?</h2>
    <p className="gate-sub">Hola, <b>{user.nombre}</b>. Elige el tipo de servicio.</p>
    <div className="svc-grid">
      <div className="svc-card" onClick={() => onPick("obra")}>
        <div className="svc-ic" style={{ background: "var(--accent)" }}><HardHat size={24} /></div>
        <h4>CONSTRUCCIÓN</h4><p>Ejecución de obra vendida: partidas, contratistas, OCs y seguimiento.</p>
      </div>
      <div className="svc-card" onClick={() => onPick("diseno")}>
        <div className="svc-ic" style={{ background: "var(--ink)" }}><Layers size={24} /></div>
        <h4>PROYECTOS</h4><p>Diseño arquitectónico e interiorismo: FIT / WORK / SIGNATURE, por m² y especialidades.</p>
      </div>
      <div className="svc-card" onClick={() => canConsult && onPick("consulta")} style={{ gridColumn: "1 / -1", opacity: canConsult ? 1 : 0.5, cursor: canConsult ? "pointer" : "not-allowed" }}>
        <div className="svc-ic" style={{ background: "#8A6D3B" }}><FolderOpen size={24} /></div>
        <h4>CONSULTA</h4><p>Revisa cotizaciones anteriores: fechas, versiones, costos y qué se cotizó. Solo lectura, sin editar.</p>
      </div>
    </div>
    <div style={{ marginTop: 18, textAlign: "center" }}><button className="gate-link" onClick={onChangeUser}>← Cambiar usuario</button></div>
  </div></div>);
}

function DisenoPlaceholder({ onBack }) {
  return (<div className="gate"><style>{CSS}</style><div className="gate-card" style={{ textAlign: "center" }}>
    <img className="gate-logo" src={DEFAULT_LOGO} alt="ORIGINA" style={{ margin: "0 auto 18px", display: "block" }} />
    <div className="svc-ic" style={{ background: "var(--ink)", margin: "0 auto 14px" }}><Layers size={24} /></div>
    <h2 className="gate-h">Cotizador de Proyectos (Diseño)</h2>
    <p className="gate-sub">Estamos construyendo este módulo. Tendrá honorarios por m² o % de obra, etapas/entregables, y el puente de crédito de diseño hacia la obra.</p>
    <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={onBack}>← Volver a elegir servicio</button>
  </div></div>);
}

function ConsultaView({ user, onBack, onChangeUser }) {
  const perms = permsOf(user);
  const allowed = [perms.consultaObra && "obra", perms.consultaDiseno && "diseno"].filter(Boolean);
  const [svc, setSvc] = useState(allowed.length === 1 ? allowed[0] : null);
  const [list, setList] = useState(null);
  const [q, setQ] = useState(null);
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState(null);
  const [verView, setVerView] = useState(null);
  useEffect(() => { if (!svc) return; setList(null); setQ(null); (async () => { const idx = (await sGet("quotes_index")) || []; setList(idx.filter((r) => (r.servicio || "obra") === svc).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))); })(); }, [svc]);
  const openQuote = async (id) => { const d = await sGet("quote_" + id); if (d) { setVerView(null); setQ(d); } };
  const svcLabel = svc === "diseno" ? "PROYECTOS (diseño)" : "CONSTRUCCIÓN (obra)";

  // Service chooser
  if (!svc) return (<div className="gate"><style>{CSS}</style><div className="gate-card">
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><img className="gate-logo" src={DEFAULT_LOGO} style={{ margin: 0, height: 30 }} /><span style={{ flex: 1 }} /><button className="btn sm" onClick={onBack}>← Servicios</button></div>
    <h2 className="gate-h">Consulta — ¿qué deseas revisar?</h2>
    <p className="gate-sub">Elige el tipo de cotización anterior a consultar.</p>
    <div className="svc-grid">
      {perms.consultaObra && <div className="svc-card" onClick={() => setSvc("obra")}><div className="svc-ic" style={{ background: "var(--accent)" }}><HardHat size={22} /></div><h4>OBRA</h4><p>Cotizaciones de construcción.</p></div>}
      {perms.consultaDiseno && <div className="svc-card" onClick={() => setSvc("diseno")}><div className="svc-ic" style={{ background: "var(--ink)" }}><Layers size={22} /></div><h4>PROYECTOS</h4><p>Cotizaciones de diseño.</p></div>}
    </div>
    <div style={{ marginTop: 16, textAlign: "center" }}><button className="gate-link" onClick={onChangeUser}>← Cambiar usuario</button></div>
  </div></div>);

  const consultaMenus = () => ([
    { id: "archivo", label: "Archivo", items: [
      { label: "Imprimir / PDF", icon: <Printer size={13} />, onClick: () => smartPDF((q && ((q.dmeta && q.dmeta.codigo) || (q.meta && q.meta.codigo))) || "Consulta"), show: !!q },
      { label: "Volver a la lista", icon: <ArrowLeft size={13} />, onClick: () => setQ(null), show: !!q },
    ] },
    { id: "ir", label: "Ir a", items: [
      { label: "Servicios", icon: <FolderOpen size={13} />, onClick: onBack },
      { label: "Cambiar tipo (Obra / Proyectos)", icon: <Layers size={13} />, onClick: () => setSvc(null), show: allowed.length > 1 },
      { label: "Cambiar usuario", icon: <Users size={13} />, onClick: onChangeUser },
    ] },
  ]);
  // Detail (read-only, richer than client quote)
  if (q) {
    if (q.__design) {
      const dparams = normDParams(q.dparams); const dc = computeDesign(q.dmeta, q.dlines || q.dmeta._lines, dparams);
      return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
        <MenuBar menu={menu} setMenu={setMenu} menus={consultaMenus()} right={<span className="mb-user">{user.nombre}</span>} />
        <div className="toolbar no-print"><button className="btn" onClick={() => setQ(null)}><ArrowLeft size={14} /> Volver a la lista</button><button className="btn primary" onClick={() => smartPDF((q.dmeta&&q.dmeta.codigo)||"Consulta")}><Printer size={14} /> Imprimir / PDF</button></div>
        {perms.interno && (<div className="ec-block" style={{ marginBottom: 12 }}><div className="ec-head"><span>Resumen interno del proyecto (diseño)</span><span className="amt">US$ {fmt(dc.totalFinal)}</span></div>
          <table className="ectable"><tbody>
            <tr><td>Total cobrado al cliente</td><td className="r">US$ {fmt(dc.totalFinal)}</td></tr>
            <tr><td>Impuestos (IVA neto + IT)</td><td className="r">US$ {fmt(dc.ivaNeto + dc.itBs)}</td></tr>
            <tr><td>GG diseño</td><td className="r">US$ {fmt(dc.ggBs)}</td></tr>
            <tr className="tot"><td>Utilidad neta (post-IUE)</td><td className="r" style={{ color: "var(--good)" }}>US$ {fmt(dc.utilNeta)}</td></tr>
            <tr><td>Crédito a obra (50% si adjudican)</td><td className="r">US$ {fmt(dc.creditoObra)}</td></tr>
          </tbody></table>
        </div>)}
        <DesignClientView dmeta={q.dmeta} dparams={dparams} />
        <p className="foot">Consulta · solo lectura (PROYECTOS / diseño).</p>
      </div>);
    }
    const params = normalizeParams(q.params); const meta = q.meta || {}; const sections = q.sections || [];
    const ib = incidAmounts(sections, params); const eParams = { ...params, _saleMul: ib.m, _incidT: ib.T };
    const totals = computeTotals(sections, eParams); const disc = discountInfo(totals.total, params, meta);
    const pa = projectAccounts(sections, params, q.contractors || {});
    const cobrado = (q.cobros || []).reduce((a, x) => a + num(x.monto), 0);
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <MenuBar menu={menu} setMenu={setMenu} menus={consultaMenus()} right={<span className="mb-user">{user.nombre}</span>} />
      <div className="toolbar no-print"><button className="btn" onClick={() => setQ(null)}><ArrowLeft size={14} /> Volver a la lista</button><button className="btn primary" onClick={() => smartPDF((meta&&meta.codigo)||"Consulta")}><Printer size={14} /> Imprimir / PDF</button></div>
      <div className="ec-block no-print" style={{ marginBottom: 12 }}><div className="ec-head"><span>Datos de la cotización (solo lectura)</span><span className="amt">{meta.codigo}</span></div>
        <table className="ectable"><tbody>
          <tr><td>Cliente</td><td className="r">{meta.cliente || "—"}</td></tr>
          <tr><td>Proyecto</td><td className="r">{meta.proyecto || "—"}</td></tr>
          <tr><td>Ubicación</td><td className="r">{meta.ubicacion || "—"}</td></tr>
          <tr><td>Fecha · Estado</td><td className="r">{meta.fecha} · {meta.estado || "Cotizada"}</td></tr>
          <tr><td>Moneda · Superficie</td><td className="r">{meta.moneda} · {meta.superficie ? meta.superficie + " m²" : "—"}</td></tr>
        </tbody></table>
      </div>

      {perms.interno && (<div className="ec-block" style={{ marginBottom: 12 }}><div className="ec-head"><span>Costos internos (cotizado vs. contratado vs. pagado)</span><span className="amt">Bs {fmt(totals.total)}</span></div>
        <table className="ectable"><tbody>
          <tr><td>Cobrado al cliente (precio de venta A+B)</td><td className="r">Bs {fmt(totals.total)}</td></tr>
          <tr><td>Costo directo cotizado</td><td className="r">Bs {fmt(pa.cotBase)}</td></tr>
          <tr><td>Costo directo contratado (real)</td><td className="r">Bs {fmt(pa.contrBase)}</td></tr>
          <tr><td>Pagado a contratistas a la fecha</td><td className="r" style={{ color: "var(--good)" }}>Bs {fmt(pa.totalP)}</td></tr>
          <tr><td>Saldo por pagar a contratistas</td><td className="r" style={{ color: pa.totalS > 0.005 ? "var(--warn)" : "var(--ink)" }}>Bs {fmt(pa.totalS)}</td></tr>
          {cobrado > 0.005 && <tr><td>Cobrado del cliente a la fecha</td><td className="r" style={{ color: "var(--good)" }}>Bs {fmt(cobrado)}</td></tr>}
          <tr className="tot"><td>Margen (cotizado − contratado)</td><td className="r">Bs {fmt(pa.margen)}</td></tr>
        </tbody></table>
        <div style={{ marginTop: 12 }}><EstadoCuentas pa={pa} /></div>
      </div>)}

      {(q.versions && q.versions.length > 0) && (<div className="ec-block no-print" style={{ marginBottom: 12 }}><div className="ec-head"><span>Versiones de esta oferta</span><span className="amt" style={{ fontSize: 11 }}>{(q.versions.length + 1)} versiones</span></div>
        <div style={{ padding: "4px 2px" }}>
          <div className="verrow" onClick={() => setVerView(null)} style={{ background: !verView ? "var(--accent-soft)" : undefined }}><span className="verchip" style={{ background: "var(--accent)" }}>V{String(meta.version || 1).padStart(2, "0")}</span><span style={{ flex: 1 }}>Versión actual (vigente)</span><span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{meta.fecha}</span></div>
          {q.versions.slice().reverse().map((vr) => (<div className="verrow" key={vr.v} onClick={() => setVerView(vr)} style={{ background: verView && verView.v === vr.v ? "var(--accent-soft)" : undefined }}><span className="verchip">V{String(vr.v).padStart(2, "0")}</span><span style={{ flex: 1 }}>Archivada · {vr.emittedBy || ""}</span><span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{vr.meta && vr.meta.fecha}{vr.emittedAt ? " · " + fmtDate(vr.emittedAt) : ""}</span></div>))}
        </div>
        {verView && <div style={{ padding: "0 2px 6px", fontSize: 11.5, color: "var(--accent-ink)" }}>Mostrando la versión archivada <b>V{String(verView.v).padStart(2, "0")}</b> (solo lectura). Haz clic en "Versión actual" para volver.</div>}
      </div>)}
      {verView
        ? <ClientView meta={verView.meta} sections={verView.sections} params={(() => { const vp = normalizeParams(verView.params); const vib = incidAmounts(verView.sections, vp); return { ...vp, _saleMul: vib.m, _incidT: vib.T }; })()} totals={computeTotals(verView.sections, { ...normalizeParams(verView.params), _saleMul: incidAmounts(verView.sections, normalizeParams(verView.params)).m })} disc={discountInfo(computeTotals(verView.sections, { ...normalizeParams(verView.params), _saleMul: incidAmounts(verView.sections, normalizeParams(verView.params)).m }).total, normalizeParams(verView.params), verView.meta)} />
        : <ClientView meta={meta} sections={sections} params={eParams} totals={totals} disc={disc} cierre={cierreFrom(meta, totals.total, eParams)} />}
      {q.audit && (<div className="ec-block" style={{ marginTop: 12 }}><div className="ec-head"><span>Registro de auditoría</span><span className="amt" style={{ fontSize: 11 }}>{q.audit.creadoPor}</span></div>
        <table className="ectable"><tbody>
          <tr><td>Creado por</td><td className="r">{q.audit.creadoPor} · {fmtDate(q.audit.creadoEn)}</td></tr>
          <tr><td>Última modificación</td><td className="r">{q.audit.modPor} · {fmtDate(q.audit.modEn)}</td></tr>
        </tbody></table>
        {(q.audit.historial || []).length > 0 && (<div style={{ marginTop: 8 }}><div className="psub-t" style={{ padding: "0 2px" }}>Historial de cambios</div>
          {q.audit.historial.slice().reverse().map((h, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, padding: "4px 2px", borderBottom: "1px solid var(--line)", color: "var(--ink2)" }}><span><b>{h.user}</b> · {h.ev}</span><span className="mono" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(h.ts)}</span></div>))}
        </div>)}
      </div>)}
      <p className="foot">Consulta · solo lectura ({svcLabel}). Esta cotización no puede editarse desde aquí.</p>
    </div>);
  }

  // List
  const rows = (list || []).filter((r) => { const s = norm(search); return !s || norm(r.codigo).includes(s) || norm(r.cliente).includes(s) || norm(r.proyecto).includes(s) || norm(r.nombre).includes(s); });
  return (<div className="gate" style={{ alignItems: "flex-start", padding: "24px 16px" }}><style>{CSS}</style>
    <div className="gate-card" style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <img className="gate-logo" src={DEFAULT_LOGO} style={{ margin: 0, height: 30 }} />
        <span style={{ flex: 1 }} />
        {allowed.length > 1 && <button className="btn sm" onClick={() => setSvc(null)}>Cambiar tipo</button>}
        <button className="btn sm" onClick={onBack}>← Servicios</button>
      </div>
      <h2 className="gate-h">Consulta · {svcLabel}</h2>
      <p className="gate-sub">Cotizaciones anteriores, en solo lectura. Toca una para ver el detalle con costos.</p>
      <input className="fld" style={{ width: "100%", marginBottom: 14 }} placeholder="Buscar por N°, cliente o proyecto…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {list === null ? <div className="empty">Cargando…</div>
        : rows.length === 0 ? <div className="empty">No hay cotizaciones de {svc === "diseno" ? "proyectos" : "obra"} guardadas{search ? " que coincidan" : ""}.</div>
          : rows.map((r) => (<button className="user-card" key={r.id} onClick={() => openQuote(r.id)} style={{ alignItems: "flex-start" }}>
            <span className="user-av" style={{ background: r.estado === "Cerrada" ? "#2E7D4F" : r.estado === "En ejecución" ? "var(--accent)" : "var(--ink)" }}><FileText size={17} /></span>
            <span style={{ flex: 1 }}>
              <span className="un">{r.codigo}{r.proyecto ? " · " + r.proyecto : (r.nombre ? " · " + r.nombre : "")}{r.esAdicional ? <span className="rolechip rc-ceo" style={{ marginLeft: 6, fontSize: 8.5 }}>ADICIONAL</span> : ""}</span>
              <span className="ur">{r.esAdicional && r.parentCodigo ? "↳ de " + r.parentCodigo + " · " : ""}{r.cliente || "Sin cliente"} · {r.fecha}{r.savedAt ? " · guardado " + fmtDate(r.savedAt) : ""}</span>
            </span>
            <span className={"rolechip " + (r.estado === "Cerrada" ? "rc-visor" : r.estado === "En ejecución" ? "rc-ceo" : "rc-colab")}>{r.estado || "Cotizada"}</span>
          </button>))}
      <div style={{ marginTop: 14, textAlign: "center" }}><button className="gate-link" onClick={onChangeUser}>← Cambiar usuario</button></div>
    </div>
  </div>);
}

/* ============================== DESIGN (PROYECTOS) ============================== */
const DESIGN_PRODUCTS = {
  FIT: { label: "Origina FIT", tag: "Funcional, rápida y costo-controlada", color: "#5B7799", key: "fit" },
  WORK: { label: "Origina WORK", tag: "Oficina corporativa para operar mejor", color: "var(--accent)", key: "work" },
  SIGNATURE: { label: "Origina SIGNATURE", tag: "Sede corporativa de alto estándar", color: "var(--ink)", key: "signature" },
};
const DEFAULT_TRAMOS = [
  { min: 60, max: 150, fit: 12, work: 16, signature: 22 },
  { min: 151, max: 300, fit: 11, work: 15, signature: 21 },
  { min: 301, max: 500, fit: 10, work: 14, signature: 20 },
  { min: 501, max: 900, fit: 8, work: 13, signature: 19 },
  { min: 901, max: 1500, fit: 7.5, work: 12, signature: 18 },
  { min: 1501, max: 999999, fit: 7, work: 11, signature: 17 },
];
const DESIGN_ESP_CATALOG = [
  { nombre: "Gestión de Licitación de Mobiliario", usm2: 2 },
  { nombre: "Proyecto Eléctrico y Luminotécnico", usm2: 1 },
  { nombre: "Proyecto Lumínico (esquemático)", usm2: 0.5 },
  { nombre: "Proyecto Eléctrico (esquemático)", usm2: 0.5 },
  { nombre: "Proyecto de Climatización (HVAC)", usm2: 1 },
  { nombre: "Proyecto de Sensores y Rociadores", usm2: 1 },
  { nombre: "Proyecto de Redes, CCTV y Acceso", usm2: 1 },
  { nombre: "Proyecto de Seguridad (Incendios)", usm2: 1 },
];
const DEFAULT_DESIGN_PARAMS = { iva: 13, it: 3, iue: 25, ggDiseno: 8, creditoFiscalPct: 0, tramos: DEFAULT_TRAMOS, tcOficial: 9.76 };
const normDParams = (p) => ({ ...DEFAULT_DESIGN_PARAMS, ...(p || {}), tramos: (p && p.tramos && p.tramos.length) ? p.tramos : DEFAULT_TRAMOS });
function suggestArqRate(product, m2, tramos) {
  const key = (DESIGN_PRODUCTS[product] || DESIGN_PRODUCTS.FIT).key;
  const t = (tramos || []).find((x) => m2 >= num(x.min) && m2 <= num(x.max)) || (tramos || [])[(tramos || []).length - 1];
  return t ? num(t[key]) : 0;
}
function computeDesign(dmeta, dlines, dparams) {
  const iva = (dparams.iva ?? 13) / 100, it = (dparams.it ?? 3) / 100, iue = (dparams.iue ?? 25) / 100, gg = (dparams.ggDiseno ?? 8) / 100, cred = (dparams.creditoFiscalPct ?? 0) / 100;
  let arq = dlines.arq;
  if (!arq || !arq.length) arq = [{ id: "seg1", producto: dmeta.producto || "FIT", m2: dmeta.superficie, usm2: dlines.arqRate }];
  const arqSegs = arq.map((s) => ({ ...s, m2n: num(s.m2), total: num(s.usm2) * num(s.m2) }));
  const m2 = arqSegs.reduce((a, s) => a + num(s.m2), 0);
  const arqTotal = arqSegs.reduce((a, s) => a + s.total, 0);
  const esp = (dlines.esp || []).map((e) => ({ ...e, total: num(e.usm2) * m2 }));
  const T = arqTotal + esp.reduce((a, e) => a + e.total, 0);
  const desc = dlines.desc || []; let dCam = 0, DcamFijo = 0, dDir = 0, DdirFijo = 0;
  desc.forEach((x) => { const modo = x.modo || "camuflado"; if (modo === "directo") { if (x.tipo === "pct") dDir += num(x.valor) / 100; else DdirFijo += num(x.valor); } else { if (x.tipo === "pct") dCam += num(x.valor) / 100; else DcamFijo += num(x.valor); } });
  if (dCam > 0.95) dCam = 0.95;
  const S_shown = T > 0 ? (T + DcamFijo) / (1 - dCam) : 0, mDisc = T > 0 ? S_shown / T : 1;
  const Ddir = dDir * T + DdirFijo, totalFinal = T - Ddir;
  const descItems = desc.map((x) => { const modo = x.modo || "camuflado"; const monto = x.tipo === "pct" ? (modo === "directo" ? num(x.valor) / 100 * T : num(x.valor) / 100 * S_shown) : num(x.valor); return { ...x, modo, monto }; });
  const ivaNeto = iva * (totalFinal - cred * totalFinal), itBs = it * totalFinal, ggBs = gg * totalFinal;
  const utilBruta = totalFinal - ivaNeto - itBs - ggBs, utilNeta = utilBruta * (1 - iue), creditoObra = 0.5 * totalFinal;
  const mixto = arqSegs.length > 1;
  return { m2, arqSegs, mixto, arqTotal, esp, T, S_shown, mDisc, descItems, totalDesc: S_shown - totalFinal, totalFinal, ivaNeto, itBs, ggBs, utilBruta, utilNeta, creditoObra };
}

function DesignClientView({ dmeta, dparams }) {
  const c = computeDesign(dmeta, dmeta._lines || { arqRate: dmeta.arqRate, esp: dmeta.esp, desc: dmeta.desc, arq: dmeta.arq }, dparams);
  const rate = dparams.tcOficial || 1; const P = (x) => "US$ " + fmt(x); const B = (x) => "Bs " + fmt(x * rate);
  const mD = c.mDisc; const logo = dmeta.logo || DEFAULT_LOGO;
  const bandLabel = c.mixto ? "PERSONALIZADO · MIXTO" : (DESIGN_PRODUCTS[c.arqSegs[0] && c.arqSegs[0].producto] || DESIGN_PRODUCTS.FIT).label;
  const bandTag = c.mixto ? c.arqSegs.map((s) => `${fmt(s.m2n)} m² ${(DESIGN_PRODUCTS[s.producto] || {}).label || ""}`).join(" · ") : (DESIGN_PRODUCTS[c.arqSegs[0] && c.arqSegs[0].producto] || DESIGN_PRODUCTS.FIT).tag;
  const bandColor = c.mixto ? "#6B5B95" : (DESIGN_PRODUCTS[c.arqSegs[0] && c.arqSegs[0].producto] || DESIGN_PRODUCTS.FIT).color;
  return (<div className="client">
    <div className="tb-top" style={{ borderRadius: 0 }}>
      <div className="logo-box"><img className="logo-img" src={logo} alt="logo" /></div>
      <div style={{ flex: 1 }}><h1>{dmeta.proyecto || "OFERTA COMERCIAL DE SERVICIOS"}</h1><div className="sub">{dmeta.cliente ? "Cliente: " + dmeta.cliente : ""}{dmeta.ubicacion ? " · " + dmeta.ubicacion : ""}</div></div>
      <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "#AEB8CA" }}><div>{dmeta.codigo}</div><div>{dmeta.fecha}</div></div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: bandColor, color: "#fff", flexWrap: "wrap" }}>
      <span style={{ fontWeight: 800, letterSpacing: ".04em" }}>{bandLabel.toUpperCase()}</span><span style={{ fontSize: 12, opacity: .9 }}>{bandTag}</span>
    </div>
    <table className="ctable">
      <thead><tr><th>Especialidad</th><th>Unid.</th><th className="r">Cantidad</th><th className="r">P.U. USD/m²</th><th className="r">Total USD</th></tr></thead>
      <tbody>
        {c.arqSegs.map((s, i) => (<tr key={s.id || i}><td>Proyecto de Arquitectura e Interiorismo{c.mixto ? ` — Nivel ${(DESIGN_PRODUCTS[s.producto] || {}).key ? (DESIGN_PRODUCTS[s.producto].label.replace("Origina ", "")) : ""}` : ""}</td><td>m²</td><td className="r">{fmt(s.m2n)}</td><td className="r">{fmt(num(s.usm2) * mD)}</td><td className="r">{fmt(s.total * mD)}</td></tr>))}
        {c.esp.map((e) => (<tr key={e.id}><td>{e.nombre}</td><td>m²</td><td className="r">{fmt(c.m2)}</td><td className="r">{fmt(num(e.usm2) * mD)}</td><td className="r">{fmt(e.total * mD)}</td></tr>))}
      </tbody>
    </table>
    <div className="grpsummary">
      {c.descItems.length > 0 ? (<>
        <div className="gsr"><span>TOTAL USD</span><b>{P(c.S_shown)}</b></div>
        {c.descItems.map((x) => <div className="gsr disc" key={x.id}><span>{x.nombre || "Descuento especial"}{x.tipo === "pct" ? ` (${fmt(num(x.valor))}%)` : ""}</span><b>− {P(x.monto)}</b></div>)}
        <div className="gsr sub"><span>TOTAL FINAL USD</span><b>{P(c.totalFinal)}</b></div>
        <div className="gsr tot"><span>TOTAL FINAL Bs (al T/C oficial)</span><b>{B(c.totalFinal)}</b></div>
      </>) : (<>
        <div className="gsr sub"><span>TOTAL USD</span><b>{P(c.totalFinal)}</b></div>
        <div className="gsr tot"><span>TOTAL Bs (al T/C oficial)</span><b>{B(c.totalFinal)}</b></div>
      </>)}
    </div>
    <div className="grpnote">
      <div><b>Forma de pago:</b> {dmeta.formaPago || "50% anticipo / 50% contra entrega de entregables."}</div>
      <div><b>Plazo de entrega:</b> {dmeta.plazoEntrega || "30 días hábiles desde firma de contrato y pago de anticipo."}</div>
      <div><b>Validez:</b> {dmeta.validez || "7 días calendario."} Incluye impuestos de ley. A pagarse en moneda nacional al T/C oficial vigente al momento del pago.</div>
    </div>
  </div>);
}

function DesignApp({ user, users, onSaveUsers, onChangeUser, onChangeService }) {
  const perms = permsOf(user); const ro = !perms.edit;
  const [dparams, setDParams] = useState(DEFAULT_DESIGN_PARAMS);
  const [dmeta, setDMeta] = useState({ codigo: "OCS_PRO_001_" + yy(), cliente: "", proyecto: "", ubicacion: "", edificio: "", superficie: "", fecha: today(), producto: "FIT", estado: "Cotizada", servicio: "diseno", formaPago: "", plazoEntrega: "", validez: "", logo: "" });
  const [dlines, setDLines] = useState({ arq: [{ id: uid(), producto: "FIT", m2: "", usm2: "" }], esp: [], desc: [] });
  const [view, setView] = useState("editor"); const [showP, setShowP] = useState(false);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState(""); const [modal, setModal] = useState(null); const [saveName, setSaveName] = useState(""); const [saved, setSaved] = useState([]);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 1800); };
  const loaded = useRef(false);
  useEffect(() => { (async () => { const p = await sGet("og_design_params"); if (p) setDParams(normDParams(p)); const d = await sGet("design_draft"); if (d) { const ddm = { ...d.dmeta }; if (ddm.codigo && !/^OCS_/.test(ddm.codigo)) ddm.codigo = fmtCodePro(codeNum(ddm.codigo) || 1); setDMeta(ddm); setDLines(d.dlines.arq ? d.dlines : { arq: [{ id: uid(), producto: d.dmeta.producto || "FIT", m2: d.dmeta.superficie, usm2: d.dlines.arqRate }], esp: d.dlines.esp || [], desc: d.dlines.desc || [] }); } else if (!ro) { const code = await reserveDCode(); setDMeta((m) => ({ ...m, codigo: code })); } loaded.current = true; })(); }, []);
  useEffect(() => { if (!loaded.current || ro) return; const h = setTimeout(() => sSet("design_draft", { dmeta, dlines }), 800); return () => clearTimeout(h); }, [dmeta, dlines]);
  const setM = (k, v) => setDMeta((m) => ({ ...m, [k]: v }));
  const c = computeDesign(dmeta, dlines, dparams);
  const addArq = () => setDLines((l) => ({ ...l, arq: [...l.arq, { id: uid(), producto: "FIT", m2: "", usm2: "" }] }));
  const setArq = (id, k, v) => setDLines((l) => ({ ...l, arq: l.arq.map((s) => s.id === id ? { ...s, [k]: v } : s) }));
  const delArq = (id) => setDLines((l) => ({ ...l, arq: l.arq.length > 1 ? l.arq.filter((s) => s.id !== id) : l.arq }));
  const applySeg = (id) => setDLines((l) => ({ ...l, arq: l.arq.map((s) => s.id === id ? { ...s, usm2: suggestArqRate(s.producto, c.m2, dparams.tramos) } : s) }));
  const addEsp = (item) => setDLines((l) => ({ ...l, esp: [...l.esp, { id: uid(), nombre: item ? item.nombre : "", usm2: item ? item.usm2 : "" }] }));
  const setEsp = (id, k, v) => setDLines((l) => ({ ...l, esp: l.esp.map((e) => e.id === id ? { ...e, [k]: v } : e) }));
  const delEsp = (id) => setDLines((l) => ({ ...l, esp: l.esp.filter((e) => e.id !== id) }));
  const addDesc = () => setDLines((l) => ({ ...l, desc: [...l.desc, { id: uid(), nombre: "Descuento especial", tipo: "fijo", valor: "", modo: "camuflado" }] }));
  const setDesc = (id, k, v) => setDLines((l) => ({ ...l, desc: l.desc.map((x) => x.id === id ? { ...x, [k]: v } : x) }));
  const delDesc = (id) => setDLines((l) => ({ ...l, desc: l.desc.filter((x) => x.id !== id) }));
  const setTramo = (i, k, v) => setDParams((p) => { const t = p.tramos.map((x, j) => j === i ? { ...x, [k]: num(v) } : x); const np = { ...p, tramos: t }; sSet("og_design_params", np); return np; });
  const setDP = (k, v) => setDParams((p) => { const np = { ...p, [k]: num(v) }; sSet("og_design_params", np); return np; });
  const syncCorrelativoDis = async (code) => { const n = codeNum(code); if (!n) return; const cur = (await sGet("og_correlativo_dis")) || 0; if (n > cur) await sSet("og_correlativo_dis", n); };
  const reserveDCode = async () => { let n = await sGet("og_correlativo_dis"); if (n == null) { const idx = (await sGet("quotes_index")) || []; n = idx.filter((r) => r.servicio === "diseno").reduce((mx, r) => Math.max(mx, codeNum(r.codigo)), 0); } n = (n || 0) + 1; await sSet("og_correlativo_dis", n); return fmtCodePro(n); };
  const prod = c.mixto ? { label: "MIXTO", color: "#6B5B95", key: "mix" } : (DESIGN_PRODUCTS[c.arqSegs[0] && c.arqSegs[0].producto] || DESIGN_PRODUCTS.FIT);
  const openSave = () => { setSaveName(dmeta.proyecto || dmeta.cliente || ""); setModal("save"); };
  const doSave = async () => { if (!hasStore()) { flash("Guardado no disponible aquí"); setModal(null); return; } const id = uid(); const rec = { id, nombre: saveName.trim() || "Sin nombre", proyecto: dmeta.proyecto, codigo: dmeta.codigo, estado: dmeta.estado, servicio: "diseno", fecha: dmeta.fecha, savedAt: Date.now() }; await sSet("quote_" + id, { __design: true, dmeta: { ...dmeta, _lines: dlines }, dlines, dparams }); const idx = (await sGet("quotes_index")) || []; idx.unshift(rec); await sSet("quotes_index", idx); flash("Proyecto guardado"); setModal(null); };
  const newQuote = async () => { if (!confirm("¿Nueva cotización de diseño?")) return; const code = await reserveDCode(); setDMeta({ codigo: code, cliente: "", proyecto: "", ubicacion: "", edificio: "", superficie: "", fecha: today(), producto: "FIT", estado: "Cotizada", servicio: "diseno", formaPago: "", plazoEntrega: "", validez: "", logo: dmeta.logo }); setDLines({ arq: [{ id: uid(), producto: "FIT", m2: "", usm2: "" }], esp: [], desc: [] }); flash("Nuevo " + code); };

  if (view === "cliente") return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
    <div className="toolbar no-print"><button className="btn" onClick={() => setView("editor")}><Pencil size={14} /> Volver a editar</button><button className="btn primary" onClick={() => smartPDF(dmeta.codigo + (dmeta.proyecto ? " - " + dmeta.proyecto : ""))}><Printer size={14} /> Imprimir / PDF</button></div>
    <DesignClientView dmeta={{ ...dmeta, _lines: dlines }} dparams={dparams} />
    {modal === "save" && (<Scrim onClose={() => setModal(null)}><div className="modal-h"><h3><Save size={17} /> Guardar proyecto</h3><button className="iconbtn" onClick={() => setModal(null)}><X size={18} /></button></div><div style={{ padding: 16 }}><input className="fld" style={{ width: "100%", marginBottom: 12 }} value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Nombre" /><button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={doSave}>Guardar</button></div></Scrim>)}
    {toast && <div className="toast">{toast}</div>}
  </div>);

  return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
    <MenuBar menu={menu} setMenu={setMenu} right={<span className="mb-user">{user.nombre}</span>} menus={[
      { id: "archivo", label: "Archivo", items: [
        { label: "Nueva cotización", icon: <FilePlus2 size={13} />, onClick: newQuote, show: perms.edit },
        { label: "Guardar", icon: <Save size={13} />, onClick: openSave, show: perms.edit },
        { divider: true },
        { label: "Vista cliente / PDF", icon: <Printer size={13} />, onClick: () => setView("cliente") },
      ] },
      { id: "ver", label: "Ver", items: [
        { label: "Editor", icon: <Pencil size={13} />, onClick: () => setView("editor") },
        { label: "Vista cliente", icon: <Eye size={13} />, onClick: () => setView("cliente") },
      ] },
      { id: "herr", label: "Herramientas", items: [
        { label: "Tarifas y parámetros", icon: <Settings2 size={13} />, onClick: () => setShowP(true), show: perms.config },
        { label: "Usuarios y permisos", icon: <Users size={13} />, onClick: () => setModal("usuarios"), show: perms.usuarios },
      ] },
    ]} />
    <div className="titleblock">
      <div className="tb-top"><div className="logo-box"><img className="logo-img" src={dmeta.logo || DEFAULT_LOGO} alt="logo" /></div>
        <div style={{ flex: 1 }}><h1>Cotizador de PROYECTOS (Diseño)</h1><div className="sub">Oferta comercial de servicios · {dmeta.codigo}</div></div>
        <span className="priv no-print" style={{ background: prod.color }}>{prod.label}</span></div>
    </div>

    <div className="userbar no-print">
      <span className="ub-av" style={{ background: ROLES[user.rol].color }}>{initials(user.nombre)}</span>
      <span className="ub-meta"><b>{user.nombre}</b><span className={"rolechip " + ROLES[user.rol].chip}>{ROLES[user.rol].label}</span></span>
      <span style={{ flex: 1 }} />
      <button className="btn sm" onClick={onChangeService}>Cambiar servicio</button>
      <button className="btn sm" onClick={onChangeUser}>Cambiar usuario</button>
    </div>
    {ro && <div className="ro-banner"><Eye size={14} /> Modo solo lectura.</div>}

    <div className="toolbar">
      {perms.config && <button className="btn" onClick={() => setShowP((s) => !s)}><Settings2 size={14} /> Tarifas</button>}
      <button className="btn primary" onClick={() => setView("cliente")}><Eye size={14} /> Vista cliente</button>
      {perms.edit && <button className="btn" onClick={openSave}><Save size={14} /> Guardar</button>}
      {perms.edit && <button className="btn ghost" onClick={newQuote}><FilePlus2 size={14} /> Nueva</button>}
    </div>

    {showP && perms.config && (<div className="panel"><div className="sec-head" style={{ cursor: "default" }}><Calculator size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Tarifas escalonadas y fiscal (diseño)</span></div>
      <div style={{ padding: "0 13px 13px" }}>
        <div className="psub-t" style={{ marginTop: 10 }}>Arquitectura USD/m² por tramo (editable · sugiere, tú ajustas)</div>
        <table className="ectable"><thead><tr><th>Tramo m²</th><th className="r">FIT</th><th className="r">WORK</th><th className="r">SIGNATURE</th></tr></thead><tbody>
          {dparams.tramos.map((t, i) => (<tr key={i}><td>{fmt(t.min)} – {t.max >= 999999 ? "+" : fmt(t.max)}</td>
            <td className="r"><input className="fld num" style={{ width: 62 }} value={t.fit} onChange={(e) => setTramo(i, "fit", e.target.value)} /></td>
            <td className="r"><input className="fld num" style={{ width: 62 }} value={t.work} onChange={(e) => setTramo(i, "work", e.target.value)} /></td>
            <td className="r"><input className="fld num" style={{ width: 62 }} value={t.signature} onChange={(e) => setTramo(i, "signature", e.target.value)} /></td></tr>))}
        </tbody></table>
        <div className="params" style={{ marginTop: 12 }}>
          <PCell label="GG diseño %" v={dparams.ggDiseno} on={(v) => setDP("ggDiseno", v)} suf="%" />
          <PCell label="Crédito fiscal estimado %" v={dparams.creditoFiscalPct} on={(v) => setDP("creditoFiscalPct", v)} suf="%" />
          <PCell label="IVA %" v={dparams.iva} on={(v) => setDP("iva", v)} suf="%" />
          <PCell label="IT %" v={dparams.it} on={(v) => setDP("it", v)} suf="%" />
          <PCell label="IUE %" v={dparams.iue} on={(v) => setDP("iue", v)} suf="%" />
          <PCell label="TC oficial" v={dparams.tcOficial} on={(v) => setDP("tcOficial", v)} suf="Bs" />
        </div>
      </div>
    </div>)}

    <fieldset className="rofs" disabled={ro}>
    <div className="panel"><div className="sec-head" style={{ cursor: "default" }}><FileText size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Datos del proyecto</span></div>
      <div className="tb-grid" style={{ padding: "0 13px 13px" }}>
        <TBCell label="Código" val={dmeta.codigo} on={(v) => { setM("codigo", v); syncCorrelativoDis(v); }} />
        <TBCell label="Cliente" val={dmeta.cliente} on={(v) => setM("cliente", v)} />
        <TBCell label="Proyecto" val={dmeta.proyecto} on={(v) => setM("proyecto", v)} />
        <TBCell label="Ubicación" val={dmeta.ubicacion} on={(v) => setM("ubicacion", v)} />
        <div className="tb-cell"><label>Superficie total (m²)</label><input value={fmt(c.m2)} readOnly style={{ background: "var(--platino)", fontWeight: 700 }} /></div>
        <TBCell label="Fecha" val={dmeta.fecha} on={(v) => setM("fecha", v)} />
        <div className="tb-cell"><label>Estado</label><select value={dmeta.estado} onChange={(e) => setM("estado", e.target.value)}><option>Cotizada</option><option>Adjudicada</option><option>En ejecución</option><option>Cerrada</option></select></div>
      </div>
    </div>

    <div className="panel"><div className="sec-head" style={{ cursor: "default" }}><Layers size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Arquitectura e Interiorismo · por nivel</span><span className="sec-sub" style={{ marginLeft: "auto" }}>US$ {fmt(c.arqTotal)}</span></div>
      <div style={{ padding: "8px 13px" }}>
        <div className="dseg-note no-print">Reparte los m² por nivel (ej. 70 m² FIT + 30 m² WORK). La tarifa sugerida se calcula sobre el total de {fmt(c.m2)} m².</div>
        {dlines.arq.map((s, i) => { const sg = suggestArqRate(s.producto, c.m2, dparams.tramos); const pc = DESIGN_PRODUCTS[s.producto] || DESIGN_PRODUCTS.FIT; return (<div className="dseg" key={s.id}>
          <span className="dseg-dot" style={{ background: pc.color }} />
          <select className="psel" value={s.producto} onChange={(e) => setArq(s.id, "producto", e.target.value)}>{Object.keys(DESIGN_PRODUCTS).map((k) => <option key={k} value={k}>{DESIGN_PRODUCTS[k].label}</option>)}</select>
          <label className="dseg-f">m²<input className="fld num" style={{ width: 72 }} inputMode="decimal" value={s.m2} placeholder="0" onChange={(e) => setArq(s.id, "m2", e.target.value)} /></label>
          <label className="dseg-f">USD/m²<input className="fld num" style={{ width: 74 }} inputMode="decimal" value={s.usm2} placeholder="0" onChange={(e) => setArq(s.id, "usm2", e.target.value)} /></label>
          {sg > 0 && c.m2 > 0 && <button className="btn sm" onClick={() => applySeg(s.id)} title="Aplicar tarifa sugerida">Sug. {fmt(sg)}</button>}
          <span className="mono" style={{ minWidth: 78, textAlign: "right", fontWeight: 700 }}>US$ {fmt(num(s.usm2) * num(s.m2))}</span>
          <button className="iconbtn no-print" onClick={() => delArq(s.id)}><Trash2 size={14} /></button>
        </div>); })}
        <button className="linkbtn" style={{ marginTop: 8 }} onClick={addArq}><Plus size={14} /> Agregar nivel</button>
      </div>
    </div>

    <div className="panel"><div className="sec-head" style={{ cursor: "default" }}><PackagePlus size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Especialidades</span></div>
      <div style={{ padding: "10px 13px" }}>
        {dlines.esp.map((e) => (<div className="crow" key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
          <input className="fld" list="esp-dl" style={{ flex: 1, minWidth: 150 }} value={e.nombre} placeholder="Especialidad" onChange={(ev) => setEsp(e.id, "nombre", ev.target.value)} />
          <input className="fld num" style={{ width: 92 }} inputMode="decimal" value={e.usm2} placeholder="USD/m²" onChange={(ev) => setEsp(e.id, "usm2", ev.target.value)} />
          <span className="mono" style={{ minWidth: 90, textAlign: "right", fontWeight: 700 }}>US$ {fmt(num(e.usm2) * c.m2)}</span>
          <button className="iconbtn no-print" onClick={() => delEsp(e.id)}><Trash2 size={14} /></button>
        </div>))}
        <datalist id="esp-dl">{DESIGN_ESP_CATALOG.map((x, i) => <option key={i} value={x.nombre} />)}</datalist>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button className="linkbtn" onClick={() => addEsp(null)}><Plus size={14} /> Agregar libre</button>
          <select className="psel" value="" onChange={(e) => { const it = DESIGN_ESP_CATALOG.find((x) => x.nombre === e.target.value); if (it) addEsp(it); e.target.value = ""; }}><option value="">+ Desde catálogo…</option>{DESIGN_ESP_CATALOG.map((x, i) => <option key={i} value={x.nombre}>{x.nombre} ({x.usm2})</option>)}</select>
        </div>
      </div>
    </div>

    <div className="panel"><div className="sec-head" style={{ cursor: "default" }}><Wallet size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Descuento especial (neto)</span></div>
      <div style={{ padding: "10px 13px" }}>
        {dlines.desc.map((x) => (<div className="incid-row" key={x.id}>
          <input className="fld" style={{ flex: 1, minWidth: 120 }} value={x.nombre} placeholder="Ej. Descuento cliente LUMA" onChange={(e) => setDesc(x.id, "nombre", e.target.value)} />
          <input className="fld num" style={{ width: 70 }} inputMode="decimal" value={x.valor} placeholder="0" onChange={(e) => setDesc(x.id, "valor", e.target.value)} />
          <select className="psel" value={x.tipo} onChange={(e) => setDesc(x.id, "tipo", e.target.value)}><option value="fijo">US$</option><option value="pct">%</option></select>
          <select className="psel" value={x.modo || "camuflado"} onChange={(e) => setDesc(x.id, "modo", e.target.value)} title="Directo: reduce tu proyección · Camuflado: neto cero"><option value="camuflado">Camuflado (neto)</option><option value="directo">Directo (real)</option></select>
          <button className="iconbtn no-print" onClick={() => delDesc(x.id)}><Trash2 size={14} /></button>
        </div>))}
        <button className="btn sm" style={{ marginTop: 8 }} onClick={addDesc}><Plus size={13} /> Agregar descuento</button>
        <div className="tc-note" style={{ marginTop: 8 }}><b>Directo:</b> el descuento sale de tu proyección (como tu oferta NOVARA: 4.336 → −15% → 3.686). <b>Camuflado:</b> se pre-infla el precio y el descuento queda neto cero (tu proyección no baja).</div>
      </div>
    </div>

    <div className="panel"><div className="sec-head" style={{ cursor: "default" }}><FileText size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Condiciones comerciales</span></div>
      <div className="tb-grid" style={{ padding: "0 13px 13px" }}>
        <TBCell label="Forma de pago" val={dmeta.formaPago} on={(v) => setM("formaPago", v)} ph="50% anticipo / 30% aprob. / 20% entrega" />
        <TBCell label="Plazo de entrega" val={dmeta.plazoEntrega} on={(v) => setM("plazoEntrega", v)} ph="30 días hábiles" />
        <TBCell label="Validez" val={dmeta.validez} on={(v) => setM("validez", v)} ph="7 días calendario" />
      </div>
    </div>
    </fieldset>

    {(() => {
      const et = ["Cotizada", "Adjudicada", "En ejecución", "Cerrada"];
      const val = (e) => data.filter((d) => d.estado === e).reduce((a, d) => a + (d.cotizado || 0), 0);
      const num_ = (e) => data.filter((d) => d.estado === e).length;
      const cotN = num_("Cotizada"), ganadasN = num_("Adjudicada") + num_("En ejecución") + num_("Cerrada");
      const conv = (cotN + ganadasN) > 0 ? ganadasN / (cotN + ganadasN) * 100 : 0;
      const maxV = Math.max(1, ...et.map(val));
      const col = { "Cotizada": "#C9CCD1", "Adjudicada": "#8A6D3B", "En ejecución": "var(--accent)", "Cerrada": "#2E7D4F" };
      return (<div className="crep" style={{ padding: "12px 14px", marginBottom: 12 }}>
        <div className="ch-t">Embudo comercial · tasa de conversión <b style={{ color: "var(--accent-ink)" }}>{fmt(conv)}%</b></div>
        <svg viewBox="0 0 700 150" style={{ width: "100%", height: "auto", display: "block" }}>
          {et.map((e, i) => { const w = 520 * (val(e) / maxV); const y = 12 + i * 34; return (<g key={e}>
            <text x="140" y={y + 14} fontSize="11" fill="#2E2F2F" textAnchor="end">{e} ({num_(e)})</text>
            <rect x="150" y={y} width={Math.max(2, w)} height="20" fill={col[e]} rx="3" />
            <text x={150 + Math.max(2, w) + 8} y={y + 14} fontSize="10" fill="#5B5C5C">Bs {fmt(val(e))}</text>
          </g>); })}
        </svg>
        <div className="ch-note">De {cotN + ganadasN} oferta(s) presentadas, {ganadasN} se convirtieron en obra.</div>
      </div>);
    })()}
    <div className="summary">
      <div className="sum-hero"><div><div className="eyebrow" style={{ color: "#B7B8B8" }}>Total final al cliente</div><div className="big">US$ {fmt(c.totalFinal)}</div><div className="usd">Bs {fmt(c.totalFinal * (dparams.tcOficial || 1))} · {fmt(c.m2)} m² · {prod.label}</div></div></div>
      {perms.ejecutivo && (<div className="sum-grid">
        <SCell k="Utilidad bruta" v={"US$ " + fmt(c.utilBruta)} />
        <SCell k="Utilidad neta (post-IUE)" v={"US$ " + fmt(c.utilNeta)} />
        <SCell k="Impuestos (IVA+IT)" v={"US$ " + fmt(c.ivaNeto + c.itBs)} />
        <SCell k="Crédito a obra (50%)" v={"US$ " + fmt(c.creditoObra)} sub="si adjudican la obra" />
      </div>)}
    </div>
    <p className="foot">Diseño = casi pura utilidad. El crédito de diseño (50%) se acredita al anticipo de obra si el cliente adjudica la construcción.</p>
    {toast && <div className="toast">{toast}</div>}
  </div>);
}

function Root() {
  const [users, setUsers] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [serviceType, setServiceType] = useState(null);
  useEffect(() => { (async () => { await migrateShared(); let u = await sGet("og_users"); if (!u || !u.length) { u = [{ id: uid(), nombre: "CEO", rol: "CEO", perms: { ...ROLES.CEO.perms }, pin: "" }]; await sSet("og_users", u); } setUsers(u); })(); }, []);
  const saveUsers = (u) => { setUsers(u); sSet("og_users", u); if (currentUser) { const yo = u.find((x) => x.id === currentUser.id); if (yo) setCurrentUser(yo); } };
  if (users === null) return (<div className="gate"><style>{CSS}</style><div className="gate-card" style={{ textAlign: "center" }}><img className="gate-logo" src={DEFAULT_LOGO} style={{ margin: "0 auto", display: "block" }} /><p className="gate-sub" style={{ marginTop: 16 }}>Cargando…</p></div></div>);
  if (!currentUser) return <Welcome users={users} onPick={(u) => setCurrentUser(u)} />;
  if (!serviceType) return <ServiceType user={currentUser} onPick={(t) => setServiceType(t)} onChangeUser={() => setCurrentUser(null)} />;
  if (serviceType === "diseno") return <DesignApp user={currentUser} users={users} onSaveUsers={saveUsers} onChangeUser={() => { setServiceType(null); setCurrentUser(null); }} onChangeService={() => setServiceType(null)} />;
  if (serviceType === "consulta") return <ConsultaView user={currentUser} onBack={() => setServiceType(null)} onChangeUser={() => { setServiceType(null); setCurrentUser(null); }} />;
  return <App user={currentUser} users={users} onSaveUsers={saveUsers} onChangeUser={() => { setServiceType(null); setCurrentUser(null); }} onChangeService={() => setServiceType(null)} />;
}

export default Root;

function App({ user, users, onSaveUsers, onChangeUser, onChangeService }) {
  const perms = permsOf(user);
  const roBase = !perms.edit;
  const s0 = STARTER();
  const [meta, setMeta] = useState(s0.meta);
  const [params, setParams] = useState(s0.params);
  const [sections, setSections] = useState(s0.sections);
  const [contractors, setContractors] = useState({});
  const [cobros, setCobros] = useState([]);
  const [informe, setInforme] = useState({ num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] });
  const [versions, setVersions] = useState([]);
  const [libCosts, setLibCosts] = useState([]);
  const [libCts, setLibCts] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [itemsCol, setItemsCol] = useState({});
  const toggleItemCol = (id) => setItemsCol((c) => ({ ...c, [id]: !c[id] }));
  const setSecItems = (sec, val) => setItemsCol((c) => { const n = { ...c }; (sec.items || []).forEach((it) => { n[it.id] = val; }); return n; });
  const toggleGrupo = (g) => setCollapsed((c) => { const secs = sections.filter((s) => (s.grupo || "A") === g); if (!secs.length) return c; const anyOpen = secs.some((s) => !c[s.id]); const n = { ...c }; secs.forEach((s) => { n[s.id] = anyOpen; }); return n; });
  const toggleTodo = () => setCollapsed((c) => { const anyOpen = sections.some((s) => !c[s.id]); const n = {}; sections.forEach((s) => { n[s.id] = anyOpen; }); return n; });
  const comprimirTodosItems = () => setItemsCol((c) => { const anyOpen = sections.some((s) => (s.items || []).some((it) => !c[it.id])); const n = {}; sections.forEach((s) => (s.items || []).forEach((it) => { n[it.id] = anyOpen; })); return n; });
  const [showParams, setShowParams] = useState(false);
  const [view, setView] = useState("hub");
  const [intTab, setIntTab] = useState("contratistas");
  const [itVista, setItVista] = useState("editor");
  useEffect(() => { if (view !== "informe") setItVista("editor"); }, [view]);
  const [hubList, setHubList] = useState(null);
  const [hubMode, setHubMode] = useState(null);
  useEffect(() => { if (view === "hub") { setHubMode(null); (async () => { const idx = (await sGet("quotes_index")) || []; setHubList(idx.filter((r) => (r.servicio || "obra") === "obra").sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))); })(); } }, [view]);
  const [modal, setModal] = useState(null);
  const [revEmit, setRevEmit] = useState(null);   // título a imprimir tras la revisión (null = abierto desde menú)
  const [saved, setSaved] = useState([]);
  const [toast, setToast] = useState("");
  const [saveName, setSaveName] = useState("");
  const [libTarget, setLibTarget] = useState(null);   // section id to insert into
  const [saveItemData, setSaveItemData] = useState(null); // item to save to lib
  const [ctTarget, setCtTarget] = useState(null);     // {sid,iid} to fill contractor
  const [saveCtData, setSaveCtData] = useState(null); // contractor to save to book
  const [ocKey, setOcKey] = useState(null);           // contractor key for purchase order
  const [libOrdenes, setLibOrdenes] = useState([]);   // emitted purchase orders (global)
  const [ocDoc, setOcDoc] = useState(null);           // a saved OC record being viewed
  const [ecName, setEcName] = useState("");           // contractor name for account statement
  const [empresa, setEmpresa] = useState(null);       // company panel data (array) or null while loading
  const [empFilter, setEmpFilter] = useState("");     // estado filter
  const [editingId, setEditingId] = useState(null);   // id of saved quote being edited in place
  const [lockRO, setLockRO] = useState(false);        // read-only because another user holds the lock
  const [lockedBy, setLockedBy] = useState("");
  const [autoBackup, setAutoBackup] = useState(false);
  const [online, setOnlineS] = useState(true);
  const [pendCount, setPendCount] = useState(0);
  const [updateAvail, setUpdateAvail] = useState(false);
  const [tcBCB, setTcBCB] = useState(null);
  const tcApplied = useRef(false);
  const histRef = useRef([]); const skipHist = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [menu, setMenu] = useState(null);
  const [pendExport, setPendExport] = useState(null);
  const verRef = useRef(null);
  const docsRef = useRef({});
  const [docTabs, setDocTabs] = useState([{ id: "t0" }]);
  const [activeDoc, setActiveDoc] = useState("t0");
  const [refRO, setRefRO] = useState(false);
  const ro = roBase || lockRO || refRO;
  const acquireLock = async (id) => {
    if (!hasStore()) { setEditingId(id); setLockRO(false); return true; }
    const lk = await readLock(id);
    if (lk && lk.user !== user.id && (Date.now() - lk.ts) < LOCK_TTL) { setEditingId(id); setLockRO(true); setLockedBy(lk.name || "otro usuario"); return false; }
    await writeLock(id, user); setEditingId(id); setLockRO(false); setLockedBy(""); return true;
  };
  const releaseEditing = async () => { if (editingId && !lockRO) await clearLock(editingId); setEditingId(null); setLockRO(false); setLockedBy(""); };
  useEffect(() => { (async () => { const ab = await rawGet("og_autobackup", false); if (ab) setAutoBackup(true); })(); }, []);
  useEffect(() => {
    if (!autoBackup) return;
    const iv = setInterval(() => { exportBase(); flash("Respaldo automático descargado"); }, 20 * 60 * 1000);
    return () => clearInterval(iv);
  }, [autoBackup, libCosts, libCts, libOrdenes]);
  const toggleAutoBackup = () => setAutoBackup((v) => { const nv = !v; rawSet("og_autobackup", nv, false); return nv; });
  const runExport = (kind, title) => { if (kind === "pdf") { flash("Generando PDF…"); smartPDF(title).then((ok) => { if (ok === false) flash("No se pudo generar el PDF (requiere internet en modo prueba)"); }); } else if (kind === "png") { flash("Generando imagen…"); exportImagen(title).then((ok) => flash(ok ? "Imagen exportada" : "No se pudo generar la imagen (requiere internet)")); } };
  const doExport = (kind) => { const title = meta.codigo + (meta.proyecto ? " - " + meta.proyecto : ""); if (view !== "cliente") { setView("cliente"); setPendExport({ kind, title }); } else runExport(kind, title); };
  useEffect(() => { if (pendExport && view === "cliente") { const t = setTimeout(() => { runExport(pendExport.kind, pendExport.title); setPendExport(null); }, 450); return () => clearTimeout(t); } }, [pendExport, view]);
  const syncNow = async () => { const r = await syncPending(); setPendCount(pendKeys().length); setOnlineS(ogIsOnline()); flash(r.done ? "Sincronizados " + r.done + " cambios" : (ogIsOnline() ? "Todo al día" : "Sin conexión al NAS")); };
  useEffect(() => {
    if (!OG_API) return;
    const unsub = ogSubscribe((v) => setOnlineS(v));
    setPendCount(pendKeys().length);
    const iv = setInterval(async () => { const ok = await ogPing(); setOnlineS(ok); if (ok && pendKeys().length) { await syncPending(); } setPendCount(pendKeys().length); }, 12000);
    return () => { unsub(); clearInterval(iv); };
  }, []);
  // auto-refresh shared libraries so what one user creates appears to others (when idle & no modal open)
  useEffect(() => {
    if (!OG_API) return;
    const iv = setInterval(async () => {
      if (modal || !ogIsOnline()) return;
      const lc = await sGet("lib_costs"); const bk = await sGet("lib_contractors"); const oc = await sGet("lib_ordenes");
      if (lc && JSON.stringify(lc) !== JSON.stringify(libCosts)) setLibCosts(lc);
      if (bk && JSON.stringify(bk) !== JSON.stringify(libCts)) setLibCts(bk);
      if (oc && JSON.stringify(oc) !== JSON.stringify(libOrdenes)) setLibOrdenes(oc);
    }, 45000);
    return () => clearInterval(iv);
  }, [modal, libCosts, libCts, libOrdenes]);
  // detect a new app version uploaded to the NAS
  useEffect(() => {
    if (!OG_API) return;
    const check = async () => { try { const r = await fetch("app.bundle.js", { method: "HEAD", cache: "no-store" }); const lm = r.headers.get("Last-Modified") || r.headers.get("ETag") || ""; if (verRef.current === null) verRef.current = lm; else if (lm && lm !== verRef.current) setUpdateAvail(true); } catch {} };
    check(); const iv = setInterval(check, 120000);
    return () => clearInterval(iv);
  }, []);
  const snapDoc = () => ({ meta, params, sections, contractors, cobros, informe, versions, editingId, lockRO, lockedBy, refRO, saveName });
  const restoreDoc = (s) => { setMeta(s.meta); setParams(s.params); setSections(s.sections); setContractors(s.contractors); setCobros(s.cobros); setInforme(s.informe); setVersions(s.versions || []); setEditingId(s.editingId); setLockRO(s.lockRO); setLockedBy(s.lockedBy || ""); setRefRO(s.refRO || false); setSaveName(s.saveName || ""); setView("editor"); setShowParams(false); };
  const switchDoc = (id) => { if (id === activeDoc) return; docsRef.current[activeDoc] = snapDoc(); const s = docsRef.current[id]; if (s) restoreDoc(s); setActiveDoc(id); };
  const docLabel = () => (meta.codigo || "Cotización") + (meta.proyecto ? " · " + meta.proyecto.slice(0, 18) : "");
  const newDocTab = async () => {
    docsRef.current[activeDoc] = snapDoc();
    const nid = "t" + uid(); const code = await reserveCode(); const st = STARTER();
    setMeta({ ...st.meta, codigo: code }); setParams(st.params); setSections(st.sections); setContractors({}); setCobros([]); setInforme({ num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] }); setEditingId(null); setLockRO(false); setLockedBy(""); setView("editor");
    setDocTabs((t) => [...t, { id: nid }]); setActiveDoc(nid); flash("Nueva pestaña · " + code);
  };
  const openInNewTab = async (id) => {
    docsRef.current[activeDoc] = snapDoc();
    const nid = "t" + uid(); setDocTabs((t) => [...t, { id: nid }]); setActiveDoc(nid);
    const d = await sGet("quote_" + id);
    if (d) { setMeta({ ...s0.meta, ...d.meta }); setParams(normalizeParams(d.params)); setSections(d.sections); setContractors(d.contractors || {}); setCobros(d.cobros || []); setMeta((mm) => migrarCobros(mm, d.cobros || [], computeTotals(d.sections || [], normalizeParams(d.params)).total)); setInforme(d.informe || { num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] }); setVersions(d.versions || []); setView("editor"); const ok = await acquireLock(id); flash(ok ? "Abierta en pestaña" : "En edición por otro · solo lectura"); }
    setModal(null);
  };
  const nuevoAdicional = async () => {
    if (!editingId || meta.esAdicional) { flash(meta.esAdicional ? "Ya es un adicional" : "Guarda primero la obra madre"); return; }
    const parentCodigo = meta.codigo, parentId = editingId;
    const idx = (await sGet("quotes_index")) || [];
    const n = idx.filter((r) => r.parentId === parentId).length + 1;
    const adCodigo = parentCodigo + "-AD" + String(n).padStart(2, "0");
    docsRef.current[activeDoc] = snapDoc();
    const nid = "t" + uid(); setDocTabs((t) => [...t, { id: nid }]); setActiveDoc(nid);
    const st = STARTER();
    setMeta({ ...st.meta, codigo: adCodigo, cliente: meta.cliente, proyecto: meta.proyecto, ubicacion: meta.ubicacion, superficie: meta.superficie, moneda: meta.moneda, grupoALabel: meta.grupoALabel, grupoBLabel: meta.grupoBLabel, grupoCLabel: meta.grupoCLabel, estado: "Cotizada", servicio: "obra", esAdicional: true, parentId, parentCodigo });
    setParams({ ...normalizeParams(params), incidencias: [], descuentos: [] });
    setSections(st.sections); setContractors({}); setCobros([]); setInforme({ num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] });
    setVersions([]); setEditingId(null); setLockRO(false); setLockedBy(""); setRefRO(false); setView("editor");
    flash("Adicional " + adCodigo + " · agrega las partidas nuevas y guarda");
  };
  const openRefTab = async (id) => {
    docsRef.current[activeDoc] = snapDoc();
    const nid = "t" + uid(); setDocTabs((t) => [...t, { id: nid }]); setActiveDoc(nid);
    const d = await sGet("quote_" + id);
    if (d) { setMeta({ ...s0.meta, ...d.meta }); setParams(normalizeParams(d.params)); setSections(d.sections); setContractors(d.contractors || {}); setCobros(d.cobros || []); setMeta((mm) => migrarCobros(mm, d.cobros || [], computeTotals(d.sections || [], normalizeParams(d.params)).total)); setInforme(d.informe || { num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] }); setVersions(d.versions || []); setEditingId(null); setLockRO(false); setLockedBy(""); setRefRO(true); setView("cliente"); flash("Abierta como referencia (solo lectura)"); }
    setModal(null);
  };
  const popOutWindow = () => {
    const el = document.querySelector(".app .client") || document.querySelector(".app .report") || document.querySelector(".app .summary");
    if (!el) { flash("Abre la Vista cliente y vuelve a intentar"); return; }
    const w = window.open("", "_blank", "width=920,height=1200,scrollbars=yes");
    if (!w) { flash("El navegador bloqueó la ventana emergente"); return; }
    const css = (typeof CSS === "string" && CSS) ? CSS : ((document.querySelector("style") || {}).textContent || "");
    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${(meta.codigo || "Cotización")} · ${(meta.proyecto || "")}</title><style>${css}\nhtml,body{background:#fff;margin:0;padding:18px}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}.app{max-width:820px;margin:0 auto}</style></head><body><div class="app">${el.outerHTML}</div></body></html>`);
    w.document.close();
    flash("Ventana abierta · arrástrala al 2° monitor");
  };
  const closeDocTab = async (id, e) => {
    if (e) e.stopPropagation();
    if (docTabs.length <= 1) { flash("Debe quedar al menos una pestaña"); return; }
    const snap = id === activeDoc ? snapDoc() : docsRef.current[id];
    if (snap && snap.editingId && !snap.lockRO) await clearLock(snap.editingId);
    delete docsRef.current[id];
    const remaining = docTabs.filter((t) => t.id !== id); setDocTabs(remaining);
    if (id === activeDoc) { const nxt = remaining[remaining.length - 1]; const s = docsRef.current[nxt.id]; if (s) restoreDoc(s); setActiveDoc(nxt.id); }
  };
  const draftLoaded = useRef(false); const libLoaded = useRef(false);
  const logoInput = useRef(null);
  const importRef = useRef(null);
  const fotoInput = useRef(null);
  const impQuoteRef = useRef(null);

  const ib = useMemo(() => incidAmounts(sections, params), [sections, params]);
  const eParams = useMemo(() => ({ ...params, _saleMul: ib.m, _incidT: ib.T }), [params, ib]);
  const totals = useMemo(() => computeTotals(sections, eParams), [sections, eParams]);
  const disc = useMemo(() => discountInfo(totals.total, params, meta), [totals, params, meta]);
  const libFlat = useMemo(() => libCosts.flatMap((c) => c.items.map((it) => ({ descripcion: it.descripcion, unidad: it.unidad, puDirecto: it.puDirecto, cat: c.nombre }))), [libCosts]);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 1700); };

  useEffect(() => {
    (async () => {
      const d = await sGet("quote_draft");
      if (d) { const dm = { ...s0.meta, ...d.meta }; if (dm.codigo && !/^OCS_/.test(dm.codigo)) dm.codigo = fmtCode(codeNum(dm.codigo) || 1); if (dm.version == null) dm.version = 1; setMeta(dm); setParams(normalizeParams(d.params)); setSections(d.sections); setContractors(d.contractors || {}); setCobros(d.cobros || []); if (d.informe) setInforme(d.informe); setVersions(d.versions || []); }
      else if (!ro) { const code = await reserveCode(); setMeta((m) => ({ ...m, codigo: code })); }
      draftLoaded.current = true;
      const lc = await sGet("lib_costs"); const bk = await sGet("lib_contractors"); const oc = await sGet("lib_ordenes");
      setLibCosts(lc && lc.length ? lc : SEED_LIB());
      setLibCts(bk || []);
      setLibOrdenes(oc || []);
      libLoaded.current = true;
    })();
  }, []);
  useEffect(() => { if (draftLoaded.current) { const h = setTimeout(() => { sSet("quote_draft", { meta, params, sections, contractors, cobros, informe, versions }); if (editingId && !lockRO && hasStore()) { sSet("quote_" + editingId, { meta, params, sections, contractors, cobros, informe, versions }); writeLock(editingId, user); } }, 900); return () => clearTimeout(h); } }, [meta, params, sections, contractors, cobros, informe, versions]);
  useEffect(() => {
    if (!editingId || lockRO) return;
    const beat = () => { writeLock(editingId, user); Object.values(docsRef.current).forEach((s) => { if (s && s.editingId && !s.lockRO && s.editingId !== editingId) writeLock(s.editingId, user); }); };
    const hb = setInterval(beat, 30000);
    const bye = () => { if (hasStore()) clearLock(editingId); };
    window.addEventListener("beforeunload", bye);
    return () => { clearInterval(hb); window.removeEventListener("beforeunload", bye); };
  }, [editingId, lockRO]);
  useEffect(() => { if (libLoaded.current) sSet("lib_costs", libCosts); }, [libCosts]);
  useEffect(() => { if (libLoaded.current) sSet("lib_contractors", libCts); }, [libCts]);
  useEffect(() => { if (libLoaded.current) sSet("lib_ordenes", libOrdenes); }, [libOrdenes]);

  const setM = (k, v) => setMeta((m) => ({ ...m, [k]: v }));
  const setP = (k, v) => setParams((p) => ({ ...p, [k]: v }));
  const setOpt = (kind, i, v) => setParams((p) => { const arr = [...p[kind]]; arr[i] = num(v); return { ...p, [kind]: arr }; });
  const addIncid = () => setParams((p) => ({ ...p, incidencias: [...(p.incidencias || []), { id: uid(), nombre: "", tipo: "fijo", valor: "", gg: p.ggDefault, util: p.utilDefault }] }));
  const setIncid = (id, f, v) => setParams((p) => ({ ...p, incidencias: (p.incidencias || []).map((x) => x.id === id ? { ...x, [f]: v } : x) }));
  const delIncid = (id) => setParams((p) => ({ ...p, incidencias: (p.incidencias || []).filter((x) => x.id !== id) }));
  const addDesc = () => setParams((p) => ({ ...p, descuentos: [...(p.descuentos || []), { id: uid(), nombre: "", tipo: "fijo", valor: "" }] }));
  const setDesc = (id, f, v) => setParams((p) => ({ ...p, descuentos: (p.descuentos || []).map((x) => x.id === id ? { ...x, [f]: v } : x) }));
  const delDesc = (id) => setParams((p) => ({ ...p, descuentos: (p.descuentos || []).filter((x) => x.id !== id) }));
  const addSection = () => setSections((s) => [...s, { id: uid(), nombre: "NUEVA PARTIDA", grupo: "A", items: [] }]);
  const setSectionGroup = (sid, g) => setSections((s) => s.map((x) => x.id === sid ? { ...x, grupo: g } : x));
  const delSection = (id) => setSections((s) => s.filter((x) => x.id !== id));
  const setSecName = (id, v) => setSections((s) => s.map((x) => x.id === id ? { ...x, nombre: (v || "").toLocaleUpperCase("es-BO") } : x));
  const addItem = (sid) => setSections((s) => s.map((x) => x.id === sid ? { ...x, items: [...x.items, newItem(params)] } : x));
  const insertItem = (sid, idx) => setSections((s) => s.map((x) => { if (x.id !== sid) return x; const items = [...x.items]; items.splice(idx, 0, newItem(params)); return { ...x, items }; }));
  const dragSecRef = useRef(null); const dragItemRef = useRef(null);
  const reorderSections = (from, to) => { if (from == null || from === to) return; setSections((l) => { const n = [...l]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; }); };
  const reorderItems = (sid, from, to) => { if (from == null || from === to) return; setSections((l) => l.map((s) => { if (s.id !== sid) return s; const n = [...s.items]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return { ...s, items: n }; })); };
  const moveItem = (sid, idx, dir) => setSections((s) => s.map((x) => { if (x.id !== sid) return x; const items = [...x.items]; const j = idx + dir; if (j < 0 || j >= items.length) return x;[items[idx], items[j]] = [items[j], items[idx]]; return { ...x, items }; }));
  const delItem = (sid, iid) => setSections((s) => s.map((x) => x.id === sid ? { ...x, items: x.items.filter((i) => i.id !== iid) } : x));
  const setItem = (sid, iid, k, v) => setSections((s) => s.map((x) => x.id === sid ? { ...x, items: x.items.map((i) => i.id === iid ? { ...i, [k]: v } : i) } : x));
  const setItemAny = (iid, k, v) => setSections((s) => s.map((x) => ({ ...x, items: x.items.map((i) => i.id === iid ? { ...i, [k]: v } : i) })));
  const setContractor = (sid, iid, k, v) => setSections((s) => s.map((x) => x.id === sid ? { ...x, items: x.items.map((i) => i.id === iid ? { ...i, contratista: { ...(i.contratista || {}), [k]: v } } : i) } : x));
  const setContractorAll = (sid, iid, obj) => setSections((s) => s.map((x) => x.id === sid ? { ...x, items: x.items.map((i) => i.id === iid ? { ...i, contratista: { ...(i.contratista || {}), ...obj } } : i) } : x));
  const addCobro = () => setCobros((c) => [...c, { id: uid(), nombre: "", monto: "", fecha: today() }]);
  const setCobro = (id, f, v) => setCobros((c) => c.map((x) => x.id === id ? { ...x, [f]: v } : x));
  const delCobro = (id) => setCobros((c) => c.filter((x) => x.id !== id));
  const loadTypicalCobros = () => setCobros([{ id: uid(), nombre: "Anticipo", monto: "", fecha: today() }, { id: uid(), nombre: "Avance 1", monto: "", fecha: "" }, { id: uid(), nombre: "Avance 2", monto: "", fecha: "" }, { id: uid(), nombre: "Saldo final", monto: "", fecha: "" }]);
  const setInf = (k, v) => setInforme((r) => ({ ...r, [k]: v }));
  const setAvance = (secId, pct) => setInforme((r) => ({ ...r, avances: { ...r.avances, [secId]: pct } }));
  const addFotos = (files) => {
    Array.from(files || []).slice(0, 8).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const max = 1100, sc = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          const durl = cv.toDataURL("image/jpeg", 0.7);
          setInforme((r) => ({ ...r, fotos: [...r.fotos, { id: uid(), src: durl, desc: "" }] }));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };
  const setFotoDesc = (id, desc) => setInforme((r) => ({ ...r, fotos: r.fotos.map((f) => f.id === id ? { ...f, desc } : f) }));
  const delFoto = (id) => setInforme((r) => ({ ...r, fotos: r.fotos.filter((f) => f.id !== id) }));
  useEffect(() => { if (view === "informe" && !ro && !informe.codigoIT) { (async () => { const code = await reserveITCode(); setInforme((r) => r.codigoIT ? r : { ...r, codigoIT: code }); })(); } }, [view]);
  const reserveITCode = async () => { let n = await sGet("og_correlativo_it"); n = (n || 0) + 1; await sSet("og_correlativo_it", n); return "IT_" + String(n).padStart(3, "0") + "_" + yy(); };
  const nuevoIT = async () => {
    const code = await reserveITCode();
    const avActual = computeAvance(sections, eParams, informe.avances).global;
    setInforme((r) => ({ ...r, codigoIT: code, num: String(num(r.num) + (r.codigoIT ? 1 : 0) || 1), fecha: today(),
      historial: [...(r.historial || []), { fecha: r.fecha || today(), pct: Math.round(avActual * 100) / 100, it: r.codigoIT || "" }] }));
    flash("Informe " + code + " · avance anterior archivado en la curva");
  };
  const insertFromLib = (sid, it) => setSections((s) => s.map((x) => x.id === sid ? { ...x, items: [...x.items, { ...newItem(params), descripcion: it.descripcion, unidad: it.unidad, puDirecto: it.puDirecto || "" }] } : x));

  // overlay
  const setC = (key, up) => setContractors((prev) => { const cur = prev[key] || { hitos: [], adicionales: [] }; return { ...prev, [key]: up(cur) }; });
  const loadTypical = (key) => setC(key, (c) => ({ ...c, hitos: TYPICAL() }));
  const addHito = (key) => setC(key, (c) => ({ ...c, hitos: [...(c.hitos || []), { id: uid(), nombre: "Avance", pct: 0, pagado: false, fecha: "", montoPagado: "" }] }));
  const setHito = (key, id, f, v) => setC(key, (c) => ({ ...c, hitos: c.hitos.map((h) => h.id === id ? { ...h, [f]: v } : h) }));
  const delHito = (key, id) => setC(key, (c) => ({ ...c, hitos: c.hitos.filter((h) => h.id !== id) }));
  const addAdic = (key) => setC(key, (c) => ({ ...c, adicionales: [...(c.adicionales || []), { id: uid(), descripcion: "", cantidad: "", pu: "", partidaId: "", moneda: "Bs", tc: "", pagado: false, fecha: "", montoPagado: "" }] }));
  const addExtraPartida = (sid, ctKey) => { const key = ctKey || "__none__"; setC(key, (c) => ({ ...c, adicionales: [...(c.adicionales || []), { id: uid(), descripcion: "", cantidad: "1", pu: "", partidaId: sid, moneda: "Bs", tc: "", pagado: false, fecha: "", montoPagado: "" }] })); setIntTab("contratistas"); flash("Compra extra creada · complétala en el contratista"); };
  const setAdic = (key, id, f, v) => setC(key, (c) => ({ ...c, adicionales: c.adicionales.map((a) => a.id === id ? { ...a, [f]: v } : a) }));
  const delAdic = (key, id) => setC(key, (c) => ({ ...c, adicionales: c.adicionales.filter((a) => a.id !== id) }));
  const setOvField = (key, f, v) => setC(key, (c) => ({ ...c, [f]: v }));
  const ocSeq = () => libOrdenes.length + 1;
  const emitirOC = (key, tipo) => {
    const c = payables(sections, params).list.find((x) => x.key === key); if (!c) return;
    const ov = contractors[key] || {};
    const principal = c.items.map((x) => ({ no: x.no, descripcion: x.descripcion, unidad: x.unidad, qReal: x.qReal, pReal: x.pReal, contratado: x.contratado }));
    const adicionales = (ov.adicionales || []).map((a) => ({ descripcion: a.descripcion, cantidad: num(a.cantidad), pu: num(a.pu), monto: montoAdic(a) }));
    const formaPago = (ov.hitos || []).map((h) => `${num(h.pct)}% ${h.nombre}`).join(" · ");
    const totalPrincipal = principal.reduce((a, x) => a + x.contratado, 0);
    const totalAdic = adicionales.reduce((a, x) => a + x.monto, 0);
    const codigo = ov.codigoOC || `${meta.codigo}_${String(ocSeq()).padStart(3, "0")}_OC`;
    const rec = {
      id: uid(), codigo, proyectoCodigo: meta.codigo, proyectoNombre: meta.proyecto, ubicacion: meta.ubicacion, logo: meta.logo || "",
      contractorKey: key, contractorName: c.info.nombre || c.info.razonSocial || "—", contractorInfo: c.info,
      fechaAdj: ov.fechaAdj || meta.fecha, plazo: ov.plazo || "", formaPago, tipo: tipo || "ambos",
      principal, adicionales, totalPrincipal, totalAdic, total: totalPrincipal + totalAdic, emitidaAt: Date.now(),
      firmante: { nombre: user.nombre, apellidos: user.apellidos || "", cargo: user.cargo || "", email: user.email || "", firma: user.firma || "" },
    };
    setLibOrdenes((l) => [rec, ...l]);
    flash("OC emitida: " + codigo);
    setIntTab("ocs"); setView("interno");
  };
  const delOC = (id) => setLibOrdenes((l) => l.filter((o) => o.id !== id));
  const addPagoOC = (ocId) => setLibOrdenes((l) => l.map((o) => o.id === ocId ? { ...o, pagos: [...(o.pagos || []), { id: uid(), fecha: today(), monto: "", metodo: "transferencia", nota: "" }] } : o));
  const setPagoOC = (ocId, pid, f, v) => setLibOrdenes((l) => l.map((o) => o.id === ocId ? { ...o, pagos: (o.pagos || []).map((p) => p.id === pid ? { ...p, [f]: v } : p) } : o));
  const delPagoOC = (ocId, pid) => setLibOrdenes((l) => l.map((o) => o.id === ocId ? { ...o, pagos: (o.pagos || []).filter((p) => p.id !== pid) } : o));
  const printAs = (title) => smartPDF(title);
  const exportExcel = () => {
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const usd = meta.moneda === "US$"; const tcX = num(meta.tcCliente) || params.tcOficial || 1; const mv = (x) => (usd ? x / tcX : x);
    const n2 = (x) => (Math.round(x * 100) / 100);
    const rows = [];
    rows.push(`<tr><td colspan="6" style="font-size:15px;font-weight:bold;color:#E34B2A">ORIGINA GROUP S.R.L.</td></tr>`);
    rows.push(`<tr><td colspan="6" style="font-weight:bold">${esc(meta.codigo)}${meta.esAdicional ? " (ADICIONAL de " + esc(meta.parentCodigo) + ")" : ""} · ${esc(meta.proyecto || "")}</td></tr>`);
    rows.push(`<tr><td colspan="6">Cliente: ${esc(meta.cliente || "")} &nbsp; Ubicación: ${esc(meta.ubicacion || "")}</td></tr>`);
    rows.push(`<tr><td colspan="6">Fecha: ${esc(meta.fecha || "")} &nbsp; Moneda: ${esc(meta.moneda)}${usd ? " (TC " + fmt(tcX) + ")" : ""} &nbsp; Estado: ${esc(meta.estado || "")}</td></tr>`);
    rows.push(`<tr></tr>`);
    rows.push(`<tr style="font-weight:bold;background:#2E2F2F;color:#fff"><td>Grupo</td><td>Partida / Descripción</td><td>Unidad</td><td>Cantidad</td><td>P.U. ${esc(meta.moneda)}</td><td>Total ${esc(meta.moneda)}</td></tr>`);
    sections.filter((s) => s.grupo !== "C").forEach((s) => {
      rows.push(`<tr style="font-weight:bold;background:#F0EFEC"><td>${esc(s.grupo)}</td><td>${esc(s.nombre)}</td><td></td><td></td><td></td><td></td></tr>`);
      (s.items || []).forEach((it) => { const c = computeItem(it, eParams); rows.push(`<tr><td></td><td>${esc(it.descripcion)}</td><td>${esc(it.unidad)}</td><td>${num(it.cantidad)}</td><td>${n2(mv(c.puVenta))}</td><td>${n2(mv(c.total))}</td></tr>`); });
    });
    rows.push(`<tr></tr>`);
    rows.push(`<tr style="font-weight:bold"><td colspan="5">Subtotal A · ${esc(meta.grupoALabel || "Arquitectura")}</td><td>${n2(mv(totals.grpA))}</td></tr>`);
    rows.push(`<tr style="font-weight:bold"><td colspan="5">Subtotal B · ${esc(meta.grupoBLabel || "Ingenierías")}</td><td>${n2(mv(totals.grpB))}</td></tr>`);
    rows.push(`<tr style="font-weight:bold;background:#FBEbe6"><td colspan="5">TOTAL A + B (Origina Group SRL)</td><td>${n2(mv(totals.total))}</td></tr>`);
    if (totals.grpC > 0.005) {
      rows.push(`<tr style="font-weight:bold"><td colspan="5">Subtotal C · ${esc(meta.grupoCLabel || "Terceros")}</td><td>${n2(mv(totals.grpC))}</td></tr>`);
      rows.push(`<tr style="font-weight:bold;background:#E4E3E0"><td colspan="5">TOTAL INVERSIÓN</td><td>${n2(mv(totals.total + totals.grpC))}</td></tr>`);
    }
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Cotización</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1" cellspacing="0">${rows.join("")}</table></body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${meta.codigo}${meta.proyecto ? " - " + meta.proyecto : ""}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
    flash("Exportado a Excel");
  };
  const exportBase = async () => {
    const idx = (await sGet("quotes_index")) || []; const quotes = {};
    for (const rec of idx) { const d = await sGet("quote_" + rec.id); if (d) quotes[rec.id] = d; }
    const base = { __originaBase: true, version: 1, exportedAt: new Date().toISOString(), libCosts, libCts, libOrdenes, quotesIndex: idx, quotes, correlativo: await sGet("og_correlativo"), users: await sGet("og_users") };
    try {
      const blob = new Blob([JSON.stringify(base, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      const d = new Date(); const stamp = d.toISOString().slice(0, 10) + "_" + String(d.getHours()).padStart(2, "0") + "h" + String(d.getMinutes()).padStart(2, "0");
      a.href = url; a.download = `ORIGINA_base_${stamp}.json`; document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      flash("Base exportada");
    } catch (e) { flash("No se pudo exportar aquí"); }
  };
  const importBase = async (file) => {
    if (!file) return;
    try {
      const text = await file.text(); const b = JSON.parse(text);
      if (!b || !b.__originaBase) { flash("Archivo no válido"); return; }
      // merge cost library (by category name + item description)
      let addedItems = 0;
      setLibCosts((cur) => {
        const out = cur.map((c) => ({ ...c, items: [...c.items] }));
        (b.libCosts || []).forEach((cat) => {
          let dest = out.find((c) => norm(c.nombre) === norm(cat.nombre));
          if (!dest) { dest = { id: uid(), nombre: cat.nombre, items: [] }; out.push(dest); }
          (cat.items || []).forEach((it) => { if (!dest.items.some((x) => norm(x.descripcion) === norm(it.descripcion))) { dest.items.push({ id: uid(), descripcion: it.descripcion, unidad: it.unidad, puDirecto: it.puDirecto }); addedItems++; } });
        });
        return out;
      });
      // merge contractors (by identity)
      let addedCts = 0;
      setLibCts((cur) => {
        const idOf = (c) => norm(c.nombre) || (c.nit || "").trim() || norm(c.razonSocial);
        const seen = new Set(cur.map(idOf)); const out = [...cur];
        (b.libCts || []).forEach((c) => { const k = idOf(c); if (k && !seen.has(k)) { seen.add(k); out.push({ ...c, id: uid() }); addedCts++; } });
        return out;
      });
      // merge emitted OCs (by codigo)
      let addedOC = 0;
      setLibOrdenes((cur) => {
        const seen = new Set(cur.map((o) => o.codigo)); const out = [...cur];
        (b.libOrdenes || []).forEach((o) => { if (!seen.has(o.codigo)) { seen.add(o.codigo); out.push({ ...o, id: o.id || uid() }); addedOC++; } });
        return out;
      });
      // merge saved quotes (upsert by id)
      let addedQuotes = 0;
      if (hasStore()) {
        const curIdx = (await sGet("quotes_index")) || []; const byId = new Set(curIdx.map((r) => r.id)); let newIdx = [...curIdx];
        const impIdx = b.quotesIndex || [];
        for (const rec of impIdx) { const data = (b.quotes || {})[rec.id]; if (!data) continue; await sSet("quote_" + rec.id, data); if (!byId.has(rec.id)) { newIdx.unshift(rec); byId.add(rec.id); addedQuotes++; } }
        await sSet("quotes_index", newIdx);
      }
      // merge correlative counter (take max) so numbering stays consistent
      if (b.correlativo != null) { const cur = (await sGet("og_correlativo")) || 0; await sSet("og_correlativo", Math.max(cur, b.correlativo)); }
      flash(`Importado: ${addedItems} ítems, ${addedCts} contratistas, ${addedOC} OC, ${addedQuotes} obras`);
    } catch (e) { flash("No se pudo leer el archivo"); }
  };

  // library
  const addCat = (nombre) => setLibCosts((l) => [...l, { id: uid(), nombre: nombre || "Nueva partida", items: [] }]);
  const delCat = (id) => setLibCosts((l) => l.filter((c) => c.id !== id));
  const addLibItem = (cid) => setLibCosts((l) => l.map((c) => c.id === cid ? { ...c, items: [...c.items, { id: uid(), descripcion: "", unidad: "pto", puDirecto: "" }] } : c));
  const setLibItem = (cid, iid, f, v) => setLibCosts((l) => l.map((c) => c.id === cid ? { ...c, items: c.items.map((i) => i.id === iid ? { ...i, [f]: v } : i) } : c));
  const delLibItem = (cid, iid) => setLibCosts((l) => l.map((c) => c.id === cid ? { ...c, items: c.items.filter((i) => i.id !== iid) } : c));
  const saveToCat = (cid, data) => setLibCosts((l) => l.map((c) => c.id === cid ? { ...c, items: [...c.items, { id: uid(), descripcion: data.descripcion || "Ítem", unidad: data.unidad || "u", puDirecto: data.puDirecto || "" }] } : c));
  const importCatalog = () => {
    setLibCosts((l) => {
      const out = l.map((c) => ({ ...c, items: [...c.items] }));
      let added = 0;
      CATALOGO_BASE.forEach((cat) => {
        let dest = out.find((c) => norm(c.nombre) === norm(cat.nombre));
        if (!dest) { dest = { id: uid(), nombre: cat.nombre, items: [] }; out.push(dest); }
        cat.items.forEach((it) => {
          if (!dest.items.some((x) => norm(x.descripcion) === norm(it.descripcion))) {
            dest.items.push({ id: uid(), descripcion: it.descripcion, unidad: it.unidad, puDirecto: String(it.pu) }); added++;
          }
        });
      });
      flash(added > 0 ? `${added} ítem(s) importados` : "El catálogo ya estaba cargado");
      return out;
    });
  };
  // contractor book
  const addBookCt = (data) => setLibCts((l) => [...l, { id: uid(), tipo: "contratista", ...data }]);
  const setBookCt = (id, f, v) => setLibCts((l) => l.map((c) => c.id === id ? { ...c, [f]: v } : c));
  const delBookCt = (id) => setLibCts((l) => l.filter((c) => c.id !== id));

  const openLibForSection = (sid) => { setLibTarget(sid); setSaveItemData(null); setModal("costlib"); };
  const openLibManage = () => { setLibTarget(null); setSaveItemData(null); setModal("costlib"); };
  const openSaveItem = (data) => { setSaveItemData(data); setLibTarget(null); setModal("costlib"); };
  const openBookForItem = (sid, iid) => { setCtTarget({ sid, iid }); setSaveCtData(null); setModal("book"); };
  const openBookManage = () => { setCtTarget(null); setSaveCtData(null); setModal("book"); };
  const openSaveCt = (data) => { setSaveCtData(data); setCtTarget(null); setModal("book"); };

  const onLogoFile = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setM("logo", r.result); r.readAsDataURL(f); };

  const syncCorrelativo = async (code) => { const n = codeNum(code); if (!n) return; const cur = (await sGet("og_correlativo")) || 0; if (n > cur) await sSet("og_correlativo", n); };
  // TC oficial del BCB: se consulta al abrir (1 vez al día) y queda guardado para uso sin conexión
  useEffect(() => { (async () => {
    const guardado = await sGet("og_tc_bcb"); if (guardado && guardado.valor) setTcBCB(guardado);
    const hoy = today(); if (guardado && guardado.diaConsulta === hoy && guardado.valor) return;
    const tc = await fetchTCOficial();
    if (tc && tc.valor > 0) { const rec = { ...tc, diaConsulta: hoy, traidoEn: Date.now() }; setTcBCB(rec); await sSet("og_tc_bcb", rec); }
  })(); }, []);
  // Aplicar automáticamente solo a cotizaciones nuevas (no guardadas)
  useEffect(() => {
    if (!tcBCB || !tcBCB.valor || tcApplied.current) return;
    if (editingId) return;                              // cotización guardada: solo avisamos
    if (Math.abs(num(params.tcOficial) - tcBCB.valor) < 0.0001) { tcApplied.current = true; return; }
    setParams((p) => ({ ...p, tcOficial: tcBCB.valor })); tcApplied.current = true;
  }, [tcBCB, editingId]);
  const aplicarTCBCB = () => { if (tcBCB && tcBCB.valor) { setParams((p) => ({ ...p, tcOficial: tcBCB.valor })); flash("TC oficial aplicado: Bs " + fmt(tcBCB.valor)); } };
  // Migra los "cobros" antiguos a los hitos de pago (una sola vez por cotización)
  const migrarCobros = (m, cb, totalBs) => {
    if (!cb || !cb.length) return m;
    if ((m.pagos || []).length) return m;
    const base = totalBs > 0 ? totalBs : cb.reduce((a, x) => a + num(x.monto), 0);
    const pagos = cb.map((x) => ({ id: uid(), detalle: x.nombre || "Cobro", pct: base > 0 ? String(Math.round(num(x.monto) / base * 10000) / 100) : "", fechaEst: x.fecha || "", cobrado: num(x.monto) > 0 && !!x.fecha, fechaReal: x.fecha || "", montoReal: String(num(x.monto) || "") }));
    return { ...m, pagos };
  };
  const exportQuote = () => {
    const payload = { __og: "quote", v: 1, exportadoEn: Date.now(), exportadoPor: user.nombre, meta, params, sections, contractors, cobros, informe, versions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = (meta.codigo || "cotizacion") + (meta.proyecto ? " - " + meta.proyecto : "") + ".ogq.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
    flash("Cotización exportada");
  };
  const importQuote = async (file) => {
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (d.__og !== "quote" || !d.meta) { flash("Ese archivo no es una cotización exportada"); return; }
      docsRef.current[activeDoc] = snapDoc();
      const nid = "t" + uid(); setDocTabs((t) => [...t, { id: nid }]); setActiveDoc(nid);
      setMeta({ ...s0.meta, ...d.meta }); setParams(normalizeParams(d.params)); setSections(d.sections || []);
      setContractors(d.contractors || {}); setCobros(d.cobros || []);
      setInforme(d.informe || { num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] });
      setVersions(d.versions || []); setEditingId(null); setLockRO(false); setLockedBy(""); setRefRO(false); setView("editor");
      await syncCorrelativo(d.meta.codigo);
      flash("Cotización " + (d.meta.codigo || "") + " importada · revísala y guárdala para incorporarla a la base");
    } catch { flash("No se pudo leer el archivo"); }
  };
  const limpiarTextos = () => {
    let n = 0;
    setSections((l) => l.map((s) => {
      const nn = limpiarTexto(s.nombre, { mayus: true }); if (nn !== s.nombre) n++;
      return { ...s, nombre: nn, items: (s.items || []).map((it) => { const d = limpiarTexto(it.descripcion, { capital: true }); if (d !== it.descripcion) n++; return d === it.descripcion ? it : { ...it, descripcion: d }; }) };
    }));
    setMeta((m) => {
      const cl = limpiarTexto(m.cliente, { capital: true }), pr = limpiarTexto(m.proyecto, { capital: true }), ub = limpiarTexto(m.ubicacion, { capital: true });
      if (cl !== m.cliente || pr !== m.proyecto || ub !== m.ubicacion) n++;
      const pagos = (m.pagos || []).map((h) => ({ ...h, detalle: limpiarTexto(h.detalle, { capital: true }) }));
      return { ...m, cliente: cl, proyecto: pr, ubicacion: ub, pagos };
    });
    flash(n > 0 ? "Textos ordenados (" + n + " ajuste(s))" : "Los textos ya estaban correctos");
  };
  /* ---- Revisión antes de enviar ---- */
  const revision = () => {
    const out = []; const add = (nivel, txt) => out.push({ nivel, txt });
    if (!(meta.cliente || "").trim()) add("alto", "Falta el nombre del cliente.");
    if (!(meta.proyecto || "").trim()) add("alto", "Falta el nombre del proyecto.");
    if (!String(meta.plazoEjecucion || "").trim()) add("medio", "No se indicó el plazo de ejecución.");
    let sinPrecio = 0, sinDesc = 0, sinCant = 0, nItems = 0;
    sections.forEach((s) => (s.items || []).forEach((it) => {
      nItems++;
      const precio = it.precioFinal ? num(it.puFinal) : (s.grupo === "C" ? num(it.monto) : num(it.puDirecto));
      if (precio <= 0) sinPrecio++;
      if (!(it.descripcion || "").trim()) sinDesc++;
      if (s.grupo !== "C" && num(it.cantidad) <= 0) sinCant++;
    }));
    if (nItems === 0) add("alto", "La cotización no tiene ítems.");
    if (sinPrecio) add("alto", sinPrecio + " ítem(s) sin precio.");
    if (sinDesc) add("medio", sinDesc + " ítem(s) sin descripción.");
    if (sinCant) add("medio", sinCant + " ítem(s) sin cantidad.");
    const vacias = sections.filter((s) => !(s.items || []).length).length;
    if (vacias) add("bajo", vacias + " partida(s) sin ítems.");
    const hitos = (meta.pagos || []).filter((h) => num(h.pct) > 0 || (h.detalle || "").trim());
    if (hitos.length === 0) add("medio", "No se definió la forma de pago.");
    else { const sum = hitos.reduce((a, h) => a + num(h.pct), 0); if (Math.abs(sum - 100) > 0.01) add("alto", "Los hitos de pago suman " + fmt(sum) + "% (deben sumar 100%)."); if (hitos.some((h) => !(h.detalle || "").trim())) add("bajo", "Hay hitos de pago sin detalle."); }
    if (meta.moneda === "US$") { const tcUsado = num(meta.tcCliente) || num(params.tcOficial); if (tcBCB && tcBCB.valor > 0 && Math.abs(tcUsado - tcBCB.valor) > 0.0001) add("medio", "La oferta usa TC " + fmt(tcUsado) + " y el oficial del BCB es " + fmt(tcBCB.valor) + "."); }
    if (cierre.activo && cierre.descBs < -0.005) add("bajo", "El precio de cierre es mayor al de lista (ajuste al alza).");
    if (totals.total <= 0) add("alto", "El total de la oferta es cero.");
    // Redacción / prolijidad de textos
    const txtObs = {};
    const acum = (t) => revisarTexto(t).forEach((o) => { txtObs[o] = (txtObs[o] || 0) + 1; });
    sections.forEach((s2) => { acum(s2.nombre === (s2.nombre || "").toLocaleUpperCase("es-BO") ? "" : s2.nombre); (s2.items || []).forEach((it) => acum(it.descripcion)); });
    (meta.pagos || []).forEach((h) => acum(h.detalle));
    acum(meta.cliente); acum(meta.proyecto); acum(meta.ubicacion);
    Object.entries(txtObs).forEach(([k, v]) => add("bajo", "Redacción: " + v + " texto(s) con " + k + "."));
    return out;
  };
  const revisionInforme = () => {
    const out = []; const add = (nivel, txt) => out.push({ nivel, txt });
    if (!(meta.cliente || "").trim()) add("alto", "Falta el nombre del cliente.");
    if (!(meta.proyecto || "").trim()) add("alto", "Falta el nombre del proyecto.");
    if (!(informe.codigoIT || "").trim()) add("medio", "El informe no tiene código IT.");
    if (!(informe.fecha || "").trim()) add("medio", "Falta la fecha del informe.");
    if (!(informe.periodo || "").trim()) add("bajo", "No se indicó el período que cubre el informe.");
    if (!(informe.fechaInicio || "").trim() || !(num(informe.plazoDias) > 0)) add("medio", "Falta fecha de inicio o plazo: la curva de avance en el tiempo no se dibuja.");
    let av = { global: 0 }; try { av = computeAvance(sections, eParams, informe.avances); } catch (e) { }
    if (!(av.global > 0)) add("alto", "El avance global es 0%.");
    if (informe.incluirFotos && (!informe.fotos || informe.fotos.length === 0)) add("bajo", "Está activado «incluir fotos» pero no hay fotos cargadas.");
    if (informe.incluirFotos && informe.fotos && informe.fotos.some((f) => !(f.desc || "").trim())) add("bajo", "Hay fotos sin descripción.");
    const acum = (t) => revisarTexto(t).forEach((o) => add("bajo", "Redacción: texto con " + o + "."));
    acum(informe.obs); acum(informe.prox);
    return out;
  };
  useEffect(() => {
    if (skipHist.current) { skipHist.current = false; return; }
    const snap = JSON.stringify({ meta, params, sections });
    const h = histRef.current;
    if (h.length && h[h.length - 1] === snap) return;
    h.push(snap); if (h.length > 40) h.shift();
    setCanUndo(h.length > 1);
  }, [meta, params, sections]);
  const undo = () => {
    const h = histRef.current;
    if (h.length < 2) { flash("Nada que deshacer"); return; }
    h.pop(); const prev = h[h.length - 1];
    try { const st = JSON.parse(prev); skipHist.current = true; setMeta(st.meta); setParams(st.params); setSections(st.sections); flash("Deshecho"); } catch {}
    setCanUndo(h.length > 1);
  };
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target || {}; const tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) return; // no pisar el deshacer del texto
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const addPago = () => setMeta((m) => ({ ...m, pagos: [...(m.pagos || []), { id: uid(), detalle: "", pct: "", fechaEst: "", cobrado: false, fechaReal: "", montoReal: "" }] }));
  const setPago = (id, f, v) => setMeta((m) => ({ ...m, pagos: (m.pagos || []).map((x) => x.id === id ? { ...x, [f]: v } : x) }));
  const delPago = (id) => setMeta((m) => ({ ...m, pagos: (m.pagos || []).filter((x) => x.id !== id) }));
  const loadTypicalPagos = () => setMeta((m) => ({ ...m, pagos: [
    { id: uid(), detalle: "Anticipo a la firma del contrato", pct: "50", fechaEst: "", cobrado: false, fechaReal: "", montoReal: "" },
    { id: uid(), detalle: "Saldo contra entrega final", pct: "50", fechaEst: "", cobrado: false, fechaReal: "", montoReal: "" },
  ] }));
  // ---- Precio de cierre negociado (factor que prorratea el descuento comercial) ----
  const rateCli = meta.moneda === "US$" ? (num(meta.tcCliente) || eParams.tcOficial || 1) : 1;
  const listaBs = totals.total;                                   // precio de lista (A+B, ya con descuentos camuflados) — SIEMPRE en Bs (interno)
  const cierreBs = num(meta.precioCierre) > 0 ? num(meta.precioCierre) : 0;   // precio de cierre en Bs; la Vista Cliente convierte
  const cierre = cierreBs > 0 && listaBs > 0
    ? { activo: true, listaBs, cierreBs, descBs: listaBs - cierreBs, factor: cierreBs / listaBs, pct: (listaBs - cierreBs) / listaBs * 100, modo: meta.cierreModo || "visible" }
    : { activo: false, listaBs, cierreBs: listaBs, descBs: 0, factor: 1, pct: 0, modo: meta.cierreModo || "visible" };
  const refrescarTCBCB = async () => { flash("Consultando BCB…"); const tc = await fetchTCOficial(true); if (tc && tc.valor > 0) { const rec = { ...tc, diaConsulta: today(), traidoEn: Date.now() }; setTcBCB(rec); await sSet("og_tc_bcb", rec); flash("TC oficial BCB: Bs " + fmt(tc.valor)); } else flash("No se pudo consultar el BCB"); };
  const reserveCode = async () => {
    let n = await sGet("og_correlativo");
    if (n == null) { const idx = (await sGet("quotes_index")) || []; n = idx.reduce((mx, r) => Math.max(mx, codeNum(r.codigo)), 0); }
    n = (n || 0) + 1; await sSet("og_correlativo", n); return fmtCode(n);
  };
  const newQuote = async () => { if (!confirm("¿Empezar una cotización nueva? Se borrará lo de pantalla (las guardadas y tus bibliotecas no se tocan).")) return; await releaseEditing(); const code = await reserveCode(); const s = STARTER(); setMeta({ ...s.meta, codigo: code }); setParams(s.params); setSections(s.sections); setContractors({}); setCobros([]); setVersions([]); flash("Cotización nueva N° " + code); };
  const openSave = () => { setSaveName(meta.proyecto || meta.cliente || meta.codigo); setModal("save"); };
  const doSave = async () => {
    if (!hasStore()) { flash("Guardado no disponible aquí"); setModal(null); return; }
    const id = editingId && !lockRO ? editingId : uid();
    await syncCorrelativo(meta.codigo);
    const now = Date.now(); const prev = editingId ? (await sGet("quote_" + id)) : null;
    const prevAudit = (prev && prev.audit) || {};
    const audit = {
      creadoPor: prevAudit.creadoPor || user.nombre, creadoPorId: prevAudit.creadoPorId || user.id, creadoEn: prevAudit.creadoEn || now,
      modPor: user.nombre, modPorId: user.id, modEn: now,
      historial: [...(prevAudit.historial || [])],
    };
    const prevEstado = prev && prev.meta && prev.meta.estado;
    if (!prev) audit.historial.push({ ts: now, user: user.nombre, ev: "Creó la cotización (" + meta.codigo + ")" });
    else if (prevEstado && prevEstado !== meta.estado) audit.historial.push({ ts: now, user: user.nombre, ev: `Cambió estado: ${prevEstado} → ${meta.estado}` });
    else audit.historial.push({ ts: now, user: user.nombre, ev: "Guardó cambios" });
    if (audit.historial.length > 60) audit.historial = audit.historial.slice(-60);
    const rec = { id, nombre: saveName.trim() || "Sin nombre", proyecto: meta.proyecto, codigo: meta.codigo, estado: meta.estado, servicio: meta.servicio || "obra", fecha: meta.fecha, savedAt: now, creadoPor: audit.creadoPor, modPor: user.nombre, esAdicional: !!meta.esAdicional, parentId: meta.parentId || null, parentCodigo: meta.parentCodigo || null };
    await sSet("quote_" + id, { meta, params, sections, contractors, cobros, informe, versions, audit });
    let idx = (await sGet("quotes_index")) || []; idx = idx.filter((r) => r.id !== id); idx.unshift(rec); await sSet("quotes_index", idx);
    if (!editingId) { await writeLock(id, user); setEditingId(id); setLockRO(false); }
    flash(editingId ? "Cambios guardados" : "Cotización guardada"); setModal(null);
  };
  const pad2 = (n) => String(n).padStart(2, "0");
  const nuevaVersion = async () => {
    if (!editingId) { flash("Guarda primero la cotización para versionarla"); return; }
    const curV = meta.version || 1;
    const snap = { v: curV, emittedAt: Date.now(), emittedBy: user.nombre, meta: { ...meta }, params, sections };
    setVersions((vs) => [...vs, snap]);
    setMeta((m) => ({ ...m, version: curV + 1, fecha: today(), estado: "Cotizada" }));
    flash("Nueva versión V" + pad2(curV + 1) + " · la V" + pad2(curV) + " quedó archivada");
  };
  const duplicateQuote = async (id) => {
    const d = await sGet("quote_" + id); if (!d) return;
    await releaseEditing(); const code = await reserveCode();
    setMeta({ ...s0.meta, ...d.meta, codigo: code, estado: "Cotizada", fecha: today() });
    setParams(normalizeParams(d.params)); setSections(JSON.parse(JSON.stringify(d.sections || []))); setContractors(JSON.parse(JSON.stringify(d.contractors || {}))); setCobros([]); setVersions([]);
    setEditingId(null); setLockRO(false); setModal(null); flash("Copiada a " + code + " · edítala y guárdala");
  };
  const openLoad = async () => { setSaved((await sGet("quotes_index")) || []); setModal("load"); };
  const openEmpresa = async () => {
    setEmpresa(null); setView("empresa");
    if (!hasStore()) { setEmpresa([]); return; }
    const idx = (await sGet("quotes_index")) || []; const out = [];
    for (const rec of idx) { const d = await sGet("quote_" + rec.id); if (d) { try { out.push({ id: rec.id, savedAt: rec.savedAt, ...quoteKPIs(d) }); } catch (e) { } } }
    setEmpresa(out);
  };
  const doLoad = async (id) => { const d = await sGet("quote_" + id); if (d) { setMeta({ ...s0.meta, ...d.meta }); setParams(normalizeParams(d.params)); setSections(d.sections); setContractors(d.contractors || {}); setCobros(d.cobros || []); setMeta((mm) => migrarCobros(mm, d.cobros || [], computeTotals(d.sections || [], normalizeParams(d.params)).total)); setInforme(d.informe || { num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] }); setVersions(d.versions || []); const ok = await acquireLock(id); flash(ok ? "Cotización cargada" : "Documento en edición por " + (lockedBy || "otro usuario") + " · solo lectura"); setView("editor"); } setModal(null); };
  const doDelete = async (id, e) => { e.stopPropagation(); if (!confirm("¿Eliminar esta cotización guardada?")) return; await rawDel("quote_" + id, true); const idx = ((await sGet("quotes_index")) || []).filter((x) => x.id !== id); await sSet("quotes_index", idx); setSaved(idx); };
  const hubNueva = async () => { await releaseEditing(); const code = await reserveCode(); const s = STARTER(); setMeta({ ...s.meta, codigo: code }); setParams(s.params); setSections(s.sections); setContractors({}); setCobros([]); setVersions([]); setInforme({ num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] }); setEditingId(null); setLockRO(false); setView("editor"); flash("Cotización nueva N° " + code); };
  const hubOpen = async (id) => { await doLoad(id); setView("editor"); };
  const hubDuplicar = async (id) => { await duplicateQuote(id); setHubMode(null); setView("editor"); };
  const hubVersion = async (id) => {
    const d = await sGet("quote_" + id); if (!d) return;
    await releaseEditing();
    const curV = (d.meta && d.meta.version) || 1;
    const snap = { v: curV, emittedAt: Date.now(), emittedBy: user.nombre, meta: { ...d.meta }, params: d.params, sections: d.sections };
    setMeta({ ...s0.meta, ...d.meta, version: curV + 1, fecha: today(), estado: "Cotizada" });
    setParams(normalizeParams(d.params)); setSections(JSON.parse(JSON.stringify(d.sections || []))); setContractors(JSON.parse(JSON.stringify(d.contractors || {}))); setCobros(d.cobros || []);
    setInforme(d.informe || { num: "1", codigoIT: "", fecha: today(), periodo: "", plazoDias: "", fechaInicio: "", fechaFin: "", obs: "", prox: "", incluirFotos: true, fotos: [], avances: {}, historial: [] });
    setVersions([...(d.versions || []), snap]);
    await acquireLock(id); setLockRO(false); setHubMode(null); setView("editor");
    flash("Nueva versión V" + pad2(curV + 1) + " · V" + pad2(curV) + " archivada");
  };
  const estadoColor = (e) => e === "En ejecución" ? { bg: "var(--good-soft)", fg: "var(--good)" } : e === "Cerrada" ? { bg: "var(--track)", fg: "var(--ink2)" } : { bg: "var(--accent-soft)", fg: "var(--accent-ink)" };

  const grossPct = totals.cd > 0 ? (totals.utilidad / totals.cd) * 100 : 0;
  const netPct = totals.cd > 0 ? (totals.utilNeta / totals.cd) * 100 : 0;
  const gMax = Math.max(grossPct, 20);

  const modals = (
    <>
      {modal === "revision" && (() => { const rs = revision(); const alto = rs.filter((r) => r.nivel === "alto").length; return (
        <Scrim onClose={() => { setModal(null); setRevEmit(null); }}>
          <div className="modal-h"><h3><ClipboardList size={17} /> Revisión antes de enviar</h3><button className="iconbtn" onClick={() => { setModal(null); setRevEmit(null); }}><X size={18} /></button></div>
          <div style={{ padding: 16, maxHeight: "65vh", overflowY: "auto" }}>
            {rs.length === 0
              ? <div className="incid-info" style={{ background: "#EAF4EE", borderColor: "#BFE0CB", color: "var(--good)" }}><b>Todo en orden.</b> La cotización no presenta observaciones: datos completos, ítems con precio y forma de pago cuadrada.</div>
              : (<>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{rs.length} observación(es){alto ? " · " + alto + " requiere(n) atención antes de enviar" : ""}.</div>
                {rs.map((r, i) => (<div key={i} className={"rev-row rev-" + r.nivel}><span className="rev-dot" /><span>{r.txt}</span></div>))}
              </>)}
          </div>
          <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
            {!ro && <button className="btn" onClick={limpiarTextos} title="Corrige espacios, puntuación, mayúsculas y palabras repetidas"><Pencil size={15} /> Corregir textos</button>}
            <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setModal(null); setRevEmit(null); }}>Volver a editar</button>
            {revEmit !== null
              ? <button className="btn primary" style={{ flex: 1, justifyContent: "center", ...(alto ? { background: "var(--warn)", color: "#fff", borderColor: "var(--warn)" } : {}) }} onClick={() => { const t = revEmit; setModal(null); setRevEmit(null); setTimeout(() => emitPDF(t), 150); }}><Printer size={15} /> {alto ? "Emitir de todos modos" : "Imprimir / PDF"}</button>
              : <button className="btn primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setModal(null); setRevEmit(null); setView("cliente"); }}><Eye size={15} /> Ver oferta</button>}
          </div>
        </Scrim>); })()}
      {modal === "revInforme" && (() => { const rs = revisionInforme(); const alto = rs.filter((r) => r.nivel === "alto").length; return (
        <Scrim onClose={() => { setModal(null); setRevEmit(null); }}>
          <div className="modal-h"><h3><ClipboardList size={17} /> Revisión del informe antes de enviar</h3><button className="iconbtn" onClick={() => { setModal(null); setRevEmit(null); }}><X size={18} /></button></div>
          <div style={{ padding: 16, maxHeight: "65vh", overflowY: "auto" }}>
            {rs.length === 0
              ? <div className="incid-info" style={{ background: "#EAF4EE", borderColor: "#BFE0CB", color: "var(--good)" }}><b>Todo en orden.</b> El informe tiene datos completos, avance registrado y la curva se dibuja.</div>
              : (<>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{rs.length} observación(es){alto ? " · " + alto + " requiere(n) atención antes de enviar" : ""}.</div>
                {rs.map((r, i) => (<div key={i} className={"rev-row rev-" + r.nivel}><span className="rev-dot" /><span>{r.txt}</span></div>))}
              </>)}
          </div>
          <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
            <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setModal(null); setRevEmit(null); }}>Volver al informe</button>
            <button className="btn primary" style={{ flex: 1, justifyContent: "center", ...(alto ? { background: "var(--warn)", color: "#fff", borderColor: "var(--warn)" } : {}) }} onClick={() => { const t = revEmit; setModal(null); setRevEmit(null); setTimeout(() => emitPDF(t), 150); }}><Printer size={15} /> {alto ? "Emitir de todos modos" : "Descargar PDF"}</button>
          </div>
        </Scrim>); })()}
      {modal === "save" && (
        <Scrim onClose={() => setModal(null)}>
          <div className="modal-h"><h3><Save size={17} /> Guardar cotización</h3><button className="iconbtn" onClick={() => setModal(null)}><X size={18} /></button></div>
          <div style={{ padding: 16 }}><label className="lbl">Nombre</label>
            <input className="fld" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Ej. Oficinas Av. Ballivián" autoFocus />
            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} onClick={doSave}><Save size={15} /> Guardar</button></div>
        </Scrim>
      )}
      {modal === "load" && (
        <Scrim onClose={() => setModal(null)}>
          <div className="modal-h"><h3><FolderOpen size={17} /> Cotizaciones guardadas</h3><button className="iconbtn" onClick={() => setModal(null)}><X size={18} /></button></div>
          {saved.length === 0 ? <div className="empty">Aún no tienes cotizaciones guardadas.</div>
            : saved.map((q) => (<div className="saved-row" key={q.id}><div style={{ flex: 1, cursor: "pointer", display: "flex", gap: 9, alignItems: "center" }} onClick={() => doLoad(q.id)}><FolderOpen size={16} color="var(--accent-ink)" /><div className="meta"><div className="nm">{q.codigo}{q.proyecto ? " · " + q.proyecto : ""}{q.esAdicional ? <span className="rolechip rc-ceo" style={{ marginLeft: 6, fontSize: 8.5 }}>ADICIONAL</span> : ""}</div><div className="dt">{q.esAdicional && q.parentCodigo ? "↳ de " + q.parentCodigo + " · " : ""}{q.fecha}{q.creadoPor ? " · creó " + q.creadoPor : ""}{q.modPor && q.modPor !== q.creadoPor ? " · últ. " + q.modPor : ""}{q.savedAt ? " · " + fmtDate(q.savedAt) : ""}</div></div></div>
              <button className="iconbtn" title="Abrir como referencia (solo lectura)" onClick={(e) => { e.stopPropagation(); openRefTab(q.id); }}><Eye size={15} /></button>
              <button className="iconbtn" title="Abrir en pestaña nueva" onClick={(e) => { e.stopPropagation(); openInNewTab(q.id); }}><Layers size={15} /></button>
              <button className="iconbtn" title="Duplicar (nueva sobre esta base)" onClick={(e) => { e.stopPropagation(); duplicateQuote(q.id); }}><FilePlus2 size={15} /></button>
              <button className="iconbtn" onClick={(e) => doDelete(q.id, e)}><Trash2 size={15} /></button></div>))}
        </Scrim>
      )}
      {modal === "costlib" && (
        <CostLibModal lib={libCosts} onClose={() => setModal(null)} onAddCat={addCat} onDelCat={delCat} onAddItem={addLibItem} onSetItem={setLibItem} onDelItem={delLibItem} onImport={importCatalog}
          target={libTarget} onInsert={(it) => { insertFromLib(libTarget, it); flash("Ítem insertado"); }} pending={saveItemData} onSaveTo={(cid) => { saveToCat(cid, saveItemData); flash("Guardado en biblioteca"); setSaveItemData(null); }} />
      )}
      {modal === "book" && (
        <BookModal lib={libCts} onClose={() => setModal(null)} onAdd={addBookCt} onSet={setBookCt} onDel={delBookCt}
          target={ctTarget} onUse={(c) => { setContractorAll(ctTarget.sid, ctTarget.iid, { nombre: c.nombre, razonSocial: c.razonSocial, nit: c.nit, contacto: c.contacto, correo: c.correo }); flash("Contratista asignado"); setModal(null); }}
          pending={saveCtData} onSavePending={() => { addBookCt(saveCtData); flash("Guardado en libreta"); setSaveCtData(null); }} />
      )}
      {modal === "backup" && (
        <Scrim onClose={() => setModal(null)}>
          <div className="modal-h"><h3><Download size={17} /> Respaldo de base</h3><button className="iconbtn" onClick={() => setModal(null)}><X size={18} /></button></div>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6, marginTop: 0 }}>Exporta <b>toda tu base</b> (biblioteca de precios, contratistas, órdenes de compra y obras guardadas) a un archivo, y guárdalo en tu <b>Synology</b>. En cualquier equipo, impórtalo para trabajar sobre la misma base. La importación <b>fusiona</b> sin duplicar.</p>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} onClick={() => { exportBase(); }}><Download size={15} /> Exportar base (descargar archivo)</button>
            <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => importRef.current && importRef.current.click()}><FolderOpen size={15} /> Importar base (desde archivo)</button>
            <label className="ab-toggle" onClick={toggleAutoBackup}><span className={"ab-sw" + (autoBackup ? " on" : "")} /><span>Autoguardar respaldo cada 20 min <span style={{ color: "var(--muted)" }}>(versión con fecha/hora, a Descargas)</span></span></label>
            <div className="note" style={{ marginTop: 14 }}><Info size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span style={{ fontSize: 11.5 }}>Flujo sugerido: exporta al terminar tu jornada y guarda el archivo en la carpeta compartida de Synology. Tu jefa de arquitectura importa ese archivo antes de cotizar. Así ambos parten de la misma base sin depender de conexión en vivo.</span></div>
          </div>
        </Scrim>
      )}
      {modal === "usuarios" && perms.usuarios && (
        <UsersModal users={users} onSave={onSaveUsers} onClose={() => setModal(null)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );

  /* ===== CLIENT VIEW ===== */
  if (view === "cliente") {
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="toolbar no-print"><button className="btn" onClick={() => setView("editor")}><Pencil size={14} /> Volver a editar</button><button className="btn" onClick={popOutWindow} title="Abrir en ventana para 2° monitor"><Layers size={14} /> Ventana</button><button className="btn primary" onClick={() => { setRevEmit(meta.codigo + (meta.proyecto ? " - " + meta.proyecto : "")); setModal("revision"); }}><ClipboardList size={14} /> Revisar antes de enviar</button></div>
      <ClientView meta={meta} sections={sections} params={eParams} totals={totals} disc={disc} cierre={cierre} firmante={{ nombre: user.nombre, apellidos: user.apellidos, cargo: user.cargo, email: user.email, firma: user.firma }} />
      <p className="foot">{meta.plazoEjecucion && <><b>Plazo de ejecución: {meta.plazoEjecucion} días hábiles.</b><br /></>}Precios en {meta.moneda === "US$" ? "dólares (US$)" : "bolivianos (Bs)"}. Incluyen impuestos de ley (IVA e IT).{meta.moneda === "US$" && ` · TC: Bs ${fmt(num(meta.tcCliente) || params.tcOficial)}/US$`}</p>
      {modals}
    </div>);
  }

  /* ===== PURCHASE ORDER — DRAFT (editable, emit) ===== */
  if (view === "oc") {
    const pay = payables(sections, params);
    const c = pay.list.find((x) => x.key === ocKey);
    const ov = contractors[ocKey] || {};
    const codeDefault = `${meta.codigo}_${String(ocSeq()).padStart(3, "0")}_OC`;
    const rec = c ? {
      codigo: ov.codigoOC || codeDefault, proyectoNombre: meta.proyecto, proyectoCodigo: meta.codigo, ubicacion: meta.ubicacion, logo: meta.logo,
      contractorName: c.info.nombre || c.info.razonSocial || "—", contractorInfo: c.info,
      fechaAdj: ov.fechaAdj || meta.fecha, plazo: ov.plazo || "",
      formaPago: (ov.hitos || []).map((h) => `${num(h.pct)}% ${h.nombre}`).join(" · "),
      principal: c.items.map((x) => ({ no: x.no, descripcion: x.descripcion, unidad: x.unidad, qReal: x.qReal, pReal: x.pReal, contratado: x.contratado })),
      adicionales: (ov.adicionales || []).map((a) => ({ descripcion: a.descripcion, cantidad: num(a.cantidad), pu: num(a.pu), monto: montoAdic(a) })),
    } : null;
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="toolbar no-print"><button className="btn" onClick={() => setView("interno")}><ArrowLeft size={14} /> Volver al control</button><button className="btn" onClick={() => smartPDF((rec && rec.codigoOC) || "Orden de compra")}><Printer size={14} /> Imprimir / PDF</button>{c && <button className="btn primary" onClick={() => emitirOC(ocKey)}><FileText size={14} /> Emitir y guardar OC</button>}</div>
      {rec ? <OCDocument rec={rec} editable onCode={(v) => setOvField(ocKey, "codigoOC", v)} onFecha={(v) => setOvField(ocKey, "fechaAdj", v)} onPlazo={(v) => setOvField(ocKey, "plazo", v)} /> : <div className="crep"><div className="empty">Contratista no encontrado.</div></div>}
      <p className="foot">Borrador. Al pulsar <b>Emitir y guardar OC</b> se numera correlativamente y se archiva en el repositorio. Uso interno.</p>
      {modals}
    </div>);
  }

  /* ===== SAVED OC (read-only) + PAGOS ===== */
  if (view === "ocdoc") {
    const rec = (ocDoc && libOrdenes.find((o) => o.id === ocDoc.id)) || ocDoc;
    const pagos = (rec && rec.pagos) || [];
    const pagado = pagos.reduce((a, p) => a + num(p.monto), 0);
    const saldo = (rec ? rec.total : 0) - pagado;
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="toolbar no-print"><button className="btn" onClick={() => { setView("interno"); setIntTab("ocs"); }}><ArrowLeft size={14} /> Volver al repositorio</button>{rec && <button className="btn" onClick={() => { setEcName(rec.contractorName); setView("estadocuenta"); }}><ClipboardList size={14} /> Estado de cuenta</button>}<button className="btn primary" onClick={() => printAs((rec ? rec.codigo : "OC"))}><Printer size={14} /> Imprimir / PDF</button></div>
      {rec ? <OCDocument rec={rec} /> : <div className="crep"><div className="empty">OC no encontrada.</div></div>}
      {rec && !ro && (<div className="panel no-print" style={{ marginTop: 12 }}>
        <div className="sec-head" style={{ cursor: "default" }}><Wallet size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Registro de pagos</span>
          <span className="sec-sub" style={{ marginLeft: "auto" }}>Pagado Bs {fmt(pagado)} · Saldo Bs {fmt(saldo)}</span></div>
        <div style={{ padding: "8px 13px" }}>
          {pagos.map((p) => (<div className="incid-row" key={p.id}>
            <input className="fld" type="date" style={{ width: 150 }} value={p.fecha} onChange={(e) => setPagoOC(rec.id, p.id, "fecha", e.target.value)} />
            <input className="fld num" style={{ width: 100 }} inputMode="decimal" value={p.monto} placeholder="Monto Bs" onChange={(e) => setPagoOC(rec.id, p.id, "monto", e.target.value)} />
            <select className="psel" value={p.metodo} onChange={(e) => setPagoOC(rec.id, p.id, "metodo", e.target.value)}><option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="efectivo">Efectivo</option></select>
            <input className="fld" style={{ flex: 1, minWidth: 120 }} value={p.nota} placeholder="Nota (Nº cheque, ref…)" onChange={(e) => setPagoOC(rec.id, p.id, "nota", e.target.value)} />
            <button className="iconbtn" onClick={() => delPagoOC(rec.id, p.id)}><Trash2 size={14} /></button>
          </div>))}
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => addPagoOC(rec.id)}><Plus size={13} /> Registrar pago</button>
        </div>
      </div>)}
      <p className="foot no-print">Orden de compra emitida · los pagos registrados alimentan el estado de cuenta del contratista.</p>
      {modals}
    </div>);
  }

  /* ===== ESTADO DE CUENTA DEL CONTRATISTA ===== */
  if (view === "estadocuenta") {
    const ocs = libOrdenes.filter((o) => norm(o.contractorName) === norm(ecName));
    const info = (ocs[0] && ocs[0].contractorInfo) || {};
    let gTotal = 0, gPag = 0;
    const rows = ocs.map((o) => { const pg = (o.pagos || []).reduce((a, p) => a + num(p.monto), 0); gTotal += o.total; gPag += pg; return { o, pagado: pg, saldo: o.total - pg }; });
    const gSaldo = gTotal - gPag;
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="toolbar no-print"><button className="btn" onClick={() => setView("ocdoc")}><ArrowLeft size={14} /> Volver</button><button className="btn primary" onClick={() => printAs("Estado de cuenta - " + ecName)}><Printer size={14} /> Imprimir / PDF</button></div>
      <div className="client">
        <div className="tb-top" style={{ borderRadius: 0 }}>
          <div className="logo-box"><img className="logo-img" src={meta.logo || DEFAULT_LOGO} alt="logo" /></div>
          <div style={{ flex: 1 }}><h1>ESTADO DE CUENTA</h1><div className="sub">Contratista: {ecName}</div></div>
          <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "#AEB8CA" }}><div>{today()}</div></div>
        </div>
        {(info.nit || info.contacto || info.correo) && (<div style={{ padding: "8px 14px", borderBottom: "1px solid var(--line)", fontSize: 11.5, color: "var(--muted)" }}>{info.razonSocial ? info.razonSocial + " · " : ""}{info.nit ? "NIT " + info.nit + " · " : ""}{info.contacto || ""}{info.correo ? " · " + info.correo : ""}</div>)}
        <div className="rep-hero" style={{ borderTop: "none" }}>
          <div className="rep-global"><div className="rg-num" style={{ fontSize: 26 }}>Bs {fmt(gSaldo)}</div><div className="rg-lb">Saldo total por pagar</div></div>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            <div className="rp-row"><span>Total contratado (todas las OCs)</span><b>Bs {fmt(gTotal)}</b></div>
            <div className="rp-row" style={{ color: "var(--good)" }}><span>Total pagado a la fecha</span><b>Bs {fmt(gPag)}</b></div>
            <div className="rp-row" style={{ color: gSaldo > 0.005 ? "var(--warn)" : "var(--ink)" }}><span>Saldo por pagar</span><b>Bs {fmt(gSaldo)}</b></div>
          </div>
        </div>
        {rows.length === 0 && <div className="empty">Este contratista no tiene órdenes de compra emitidas.</div>}
        {rows.map(({ o, pagado, saldo }) => (<div key={o.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <div><b style={{ fontSize: 13 }}>{o.codigo}</b> <span style={{ fontSize: 11.5, color: "var(--muted)" }}>· {o.proyectoNombre || o.proyectoCodigo} · emitida {o.fechaAdj || fmtDate(o.emitidaAt)}</span></div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>Contratado Bs {fmt(o.total)} · Pagado Bs {fmt(pagado)} · <b style={{ color: saldo > 0.005 ? "var(--warn)" : "var(--good)" }}>Saldo Bs {fmt(saldo)}</b></div>
          </div>
          {(o.pagos || []).length > 0 && (<table className="ectable" style={{ marginTop: 8 }}><thead><tr><th>Fecha efectiva</th><th>Método</th><th>Nota</th><th className="r">Monto Bs</th></tr></thead>
            <tbody>{(o.pagos || []).map((p) => (<tr key={p.id}><td>{p.fecha}</td><td style={{ textTransform: "capitalize" }}>{p.metodo}</td><td>{p.nota || "—"}</td><td className="r">{fmt(num(p.monto))}</td></tr>))}</tbody>
          </table>)}
          {(o.pagos || []).length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>Sin pagos registrados.</div>}
        </div>))}
        <FirmaBlock firmante={{ nombre: user.nombre, apellidos: user.apellidos, cargo: user.cargo, email: user.email, firma: user.firma }} />
      </div>
      <p className="foot no-print">Estado de cuenta consolidado del contratista · todas sus órdenes de compra y pagos.</p>
      {modals}
    </div>);
  }

  /* ===== COMPANY PANEL ===== */
  if (view === "empresa" && perms.ejecutivo) {
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="toolbar no-print"><button className="btn" onClick={() => setView("editor")}><Pencil size={14} /> Volver a editar</button><button className="btn" onClick={openEmpresa}>↻ Actualizar</button><button className="btn primary" onClick={() => window.print()}><Printer size={14} /> Imprimir / PDF</button></div>
      <EmpresaView data={empresa} filter={empFilter} setFilter={setEmpFilter} onOpen={(id) => doLoad(id)} tcO={params.tcOficial || 1} />
      <p className="foot">Panel empresa · consolida las cotizaciones guardadas en este dispositivo. Guarda cada obra para verla aquí.</p>
      {modals}
    </div>);
  }

  /* ===== INFORME DE AVANCE (cliente) ===== */
  if (view === "informe") {
    const av = computeAvance(sections, eParams, informe.avances);
    const parseD = (s) => { const d = new Date(s); return isNaN(d) ? null : d; };
    const fi = parseD(informe.fechaInicio), ff = parseD(informe.fechaFin);
    const diasPlazo = num(informe.plazoDias) > 0 ? num(informe.plazoDias) : (fi && ff ? Math.round((ff - fi) / 86400000) : 0);
    const diasTrans = fi ? Math.max(0, Math.round((Date.now() - fi) / 86400000)) : 0;
    const pctTiempo = diasPlazo > 0 ? Math.min(100, diasTrans / diasPlazo * 100) : 0;
    const desfase = av.global - pctTiempo;
    const estadoPlazo = diasPlazo === 0 || !fi ? "—" : desfase >= 2 ? "Adelantado" : desfase <= -5 ? "Atrasado" : "En tiempo";
    const bar = (pct, color) => (<div className="avbar"><div className="avbar-f" style={{ width: Math.min(100, pct) + "%", background: color }} /></div>);
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      {itVista === "cliente" ? (
      <div className="toolbar no-print"><button className="btn" onClick={() => setItVista("editor")}><Pencil size={14} /> Volver al editor del informe</button><button className="btn primary" onClick={() => { setRevEmit((informe.codigoIT || "Informe") + " - " + (meta.proyecto || meta.codigo)); setModal("revInforme"); }}><ClipboardList size={14} /> Revisar antes de enviar</button></div>
      ) : (
      <div className="toolbar no-print"><button className="btn" onClick={() => setView("editor")}><Pencil size={14} /> Volver a editar</button>{!ro && <button className="btn" onClick={nuevoIT}><FilePlus2 size={14} /> Nuevo IT</button>}<button className="btn" onClick={() => setItVista("cliente")}><Eye size={14} /> Vista cliente</button><button className="btn primary" onClick={() => { setRevEmit((informe.codigoIT || "Informe") + " - " + (meta.proyecto || meta.codigo)); setModal("revInforme"); }}><ClipboardList size={14} /> Revisar antes de enviar</button></div>
      )}

      {itVista === "editor" && (<div className="panel no-print"><div className="sec-head" style={{ cursor: "default" }}><FileText size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Datos del informe técnico</span>{informe.codigoIT && <span className="sec-sub" style={{ marginLeft: "auto" }}>{informe.codigoIT}</span>}</div>
        <div className="tb-grid" style={{ padding: "0 13px 13px" }}>
          <TBCell label="Código IT" val={informe.codigoIT} on={(v) => setInf("codigoIT", v)} ph="IT_001_26" />
          <TBCell label="Informe N°" val={informe.num} on={(v) => setInf("num", v)} />
          <TBCell label="Fecha del informe" val={informe.fecha} on={(v) => setInf("fecha", v)} />
          <div className="tb-cell"><label>Fecha efectiva de inicio</label><input type="date" value={informe.fechaInicio} onChange={(e) => setInf("fechaInicio", e.target.value)} /></div>
          <TBCell label="Plazo (días)" val={informe.plazoDias} on={(v) => setInf("plazoDias", v)} ph="Ej. 60" />
          <div className="tb-cell"><label>Fecha de fin (prevista)</label><input type="date" value={informe.fechaFin} onChange={(e) => setInf("fechaFin", e.target.value)} /></div>
          <TBCell label="Período que cubre" val={informe.periodo} on={(v) => setInf("periodo", v)} ph="01 al 15 jul 2026" />
        </div>
        <div style={{ padding: "0 13px 13px" }}>
          <div className="psub-t">Avance por partida (%)</div>
          {av.rows.map((r) => (<div key={r.id} className="avrow"><span className="avdot" style={{ background: r.grupo === "B" ? "var(--ink)" : "var(--accent)" }} /><span style={{ flex: 1, fontSize: 12.5 }}>{r.nombre}</span><input className="fld num" style={{ width: 70 }} inputMode="decimal" value={informe.avances[r.id] ?? ""} placeholder="0" onChange={(e) => setAvance(r.id, e.target.value)} /><span style={{ fontSize: 11, width: 46 }}>%</span></div>))}
          {av.rows.length === 0 && <div className="empty">No hay partidas A/B en esta obra.</div>}
        </div>
        <div style={{ padding: "0 13px 13px" }}>
          <label className="lbl">Observaciones / hitos logrados</label><textarea className="fld" style={{ width: "100%", minHeight: 60 }} value={informe.obs} onChange={(e) => setInf("obs", e.target.value)} />
          <label className="lbl" style={{ marginTop: 8 }}>Próximos pasos</label><textarea className="fld" style={{ width: "100%", minHeight: 50 }} value={informe.prox} onChange={(e) => setInf("prox", e.target.value)} />
        </div>
        <div style={{ padding: "0 13px 13px" }}>
          <label className="ab-toggle" onClick={() => setInf("incluirFotos", !informe.incluirFotos)}><span className={"ab-sw" + (informe.incluirFotos ? " on" : "")} /><span>Incluir registro fotográfico</span></label>
          {informe.incluirFotos && (<div style={{ marginTop: 10 }}>
            <input ref={fotoInput} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addFotos(e.target.files); e.target.value = ""; }} />
            <button className="btn sm" onClick={() => fotoInput.current && fotoInput.current.click()}><PackagePlus size={13} /> Agregar fotos</button>
            <div className="fotogrid" style={{ marginTop: 10 }}>
              {informe.fotos.map((f) => (<div className="fotocard no-print-controls" key={f.id}><img src={f.src} alt="" /><input className="fld" style={{ width: "100%", fontSize: 11 }} value={f.desc} placeholder="Descripción" onChange={(e) => setFotoDesc(f.id, e.target.value)} /><button className="iconbtn" onClick={() => delFoto(f.id)}><Trash2 size={13} /></button></div>))}
            </div>
          </div>)}
        </div>
      </div>)}

      {itVista === "cliente" && <div className="no-print" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Previsualización — así verá el cliente el informe (el bloque de datos internos queda oculto y no se imprime).</div>}

      {/* ===== PRINTABLE REPORT ===== */}
      <div className="client report">
        <div className="tb-top" style={{ borderRadius: 0 }}>
          <div className="logo-box"><img className="logo-img" src={meta.logo || DEFAULT_LOGO} alt="logo" /></div>
          <div style={{ flex: 1 }}><h1>INFORME TÉCNICO DE AVANCE</h1><div className="sub">{meta.proyecto || "Obra"}{meta.cliente ? " · " + meta.cliente : ""}</div></div>
          <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "#AEB8CA" }}><div>{informe.codigoIT || "IT"}</div><div>Informe N° {informe.num} · {informe.fecha}</div></div>
        </div>
        <div className="rep-meta">
          <div><span>Código obra</span><b>{meta.codigo}</b></div>
          <div><span>Cliente</span><b>{meta.cliente || "—"}</b></div>
          <div><span>Ubicación</span><b>{meta.ubicacion || "—"}</b></div>
          <div><span>Período</span><b>{informe.periodo || "—"}</b></div>
          <div><span>Inicio efectivo</span><b>{informe.fechaInicio || "—"}</b></div>
          <div><span>Fin previsto</span><b>{informe.fechaFin || "—"}</b></div>
          <div><span>Plazo</span><b>{diasPlazo > 0 ? diasPlazo + " días" : "—"}</b></div>
          <div><span>Transcurrido</span><b>{fi ? diasTrans + " días" : "—"}</b></div>
        </div>

        <div className="rep-hero">
          <div className="rep-global"><div className="rg-num">{fmt(av.global)}%</div><div className="rg-lb">Avance físico global</div></div>
          <div style={{ flex: 1 }}>
            {bar(av.global, "var(--accent)")}
            {av.hasA && av.hasB && (<div style={{ marginTop: 10 }}>
              <div className="rep-gline"><span><i className="dot" style={{ background: "var(--accent)" }} /> {meta.grupoALabel || "Arquitectura"}</span><b>{fmt(av.grpA)}%</b></div>{bar(av.grpA, "var(--accent)")}
              <div className="rep-gline" style={{ marginTop: 6 }}><span><i className="dot" style={{ background: "var(--ink)" }} /> {meta.grupoBLabel || "Ingenierías"}</span><b>{fmt(av.grpB)}%</b></div>{bar(av.grpB, "var(--ink)")}
            </div>)}
          </div>
        </div>

        {diasPlazo > 0 && fi && (<div className="rep-plazo">
          <div className="rp-row"><span>Avance físico</span><b>{fmt(av.global)}%</b></div>{bar(av.global, "var(--accent)")}
          <div className="rp-row" style={{ marginTop: 8 }}><span>Avance sobre el plazo ({diasTrans}/{diasPlazo} días)</span><b>{fmt(pctTiempo)}%</b></div>{bar(pctTiempo, "#8A6D3B")}
          <div className={"rp-status rp-" + (estadoPlazo === "Adelantado" ? "ok" : estadoPlazo === "Atrasado" ? "bad" : "go")}>Estado del cronograma: <b>{estadoPlazo}</b>{estadoPlazo !== "—" ? ` (${desfase >= 0 ? "+" : ""}${fmt(desfase)} pts vs. plazo)` : ""}</div>
        </div>)}

        {informe.fechaInicio && diasPlazo > 0 && (<div className="chart-box">
          <div className="rep-h">Avance ejecutado en el tiempo</div>
          <CurvaS inicio={informe.fechaInicio} fin={informe.fechaFin} plazoDias={diasPlazo} historial={informe.historial} actual={av.global} fechaActual={informe.fecha} />
        </div>)}
        <table className="ctable"><thead><tr><th style={{ width: 34 }}>N°</th><th>Partida</th><th>Grupo</th><th className="r">Avance</th><th>Estado</th></tr></thead>
          <tbody>{av.rows.map((r, i) => (<tr key={r.id}><td className="mono" style={{ color: "var(--muted)" }}>{i + 1}</td><td>{r.nombre}</td><td>{r.grupo === "B" ? (meta.grupoBLabel || "Ing.") : (meta.grupoALabel || "Arq.")}</td><td className="r">{fmt(r.pct)}%</td><td><span className={"estchip est-" + (r.estado === "Terminada" ? "ok" : r.estado === "En curso" ? "go" : "no")}>{r.estado}</span></td></tr>))}</tbody>
        </table>

        {informe.incluirFotos && informe.fotos.length > 0 && (<div className="rep-fotos">
          <div className="rep-h">Registro fotográfico</div>
          <div className="fotogrid">{informe.fotos.map((f) => (<div className="fotocard" key={f.id}><img src={f.src} alt="" />{f.desc && <div className="fcap">{f.desc}</div>}</div>))}</div>
        </div>)}

        {(informe.obs || informe.prox) && (<div className="rep-notes">
          {informe.obs && (<div className="rep-note-b"><div className="rep-h">Observaciones y hitos logrados</div><div style={{ whiteSpace: "pre-wrap" }}>{informe.obs}</div></div>)}
          {informe.prox && (<div className="rep-note-b"><div className="rep-h">Próximos pasos</div><div style={{ whiteSpace: "pre-wrap" }}>{informe.prox}</div></div>)}
        </div>)}

        <FirmaBlock firmante={{ nombre: user.nombre, apellidos: user.apellidos, cargo: user.cargo, email: user.email, firma: user.firma }} />
      </div>
      {modals}
    </div>);
  }

  /* ===== EXECUTIVE SUMMARY VIEW ===== */
  if (view === "resumen" && perms.ejecutivo) {
    const pa = projectAccounts(sections, params, contractors);
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="toolbar no-print"><button className="btn" onClick={() => setView("editor")}><Pencil size={14} /> Volver a editar</button><button className="btn primary" onClick={() => window.print()}><Printer size={14} /> Imprimir / PDF</button></div>
      <SummaryView meta={meta} params={params} totals={totals} pa={pa} ib={ib} disc={disc} cobros={cobros} hitosPago={(meta.pagos || []).filter((h) => num(h.pct) > 0 || (h.detalle || "").trim())} contrato={cierre.cierreBs} onAddCobro={addCobro} onSetCobro={setCobro} onDelCobro={delCobro} onLoadTypicalCobros={loadTypicalCobros} />
      <p className="foot">Resumen ejecutivo · uso interno. Cotizado = precio al cliente. Real = en base a lo efectivamente contratado.</p>
      {modals}
    </div>);
  }

  /* ===== INTERNAL VIEW ===== */
  if (view === "interno" && perms.interno) {
    const pay = payables(sections, params); const pa = projectAccounts(sections, params, contractors);
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="toolbar no-print"><button className="btn" onClick={() => setView("editor")}><Pencil size={14} /> Volver a editar</button><button className="btn primary" onClick={() => window.print()}><Printer size={14} /> Imprimir / PDF</button></div>
      <div className="titleblock" style={{ marginBottom: 12 }}><div className="tb-top"><ClipboardList size={20} /><div style={{ flex: 1 }}><h1>CONTROL INTERNO · SUBCONTRATOS</h1><div className="sub">{meta.proyecto || "Proyecto"} · {meta.codigo}</div></div><span className="priv no-print">PRIVADO</span></div></div>
      <div className="subtabs no-print"><button className={intTab === "contratistas" ? "on" : ""} onClick={() => setIntTab("contratistas")}><HardHat size={14} /> Por contratista</button><button className={intTab === "partidas" ? "on" : ""} onClick={() => setIntTab("partidas")}><Layers size={14} /> Resguardo por partida</button><button className={intTab === "caja" ? "on" : ""} onClick={() => setIntTab("caja")}><TrendingUp size={14} /> Flujo de caja</button><button className={intTab === "balance" ? "on" : ""} onClick={() => setIntTab("balance")}><Wallet size={14} /> Estado de cuentas</button><button className={intTab === "ocs" ? "on" : ""} onClick={() => setIntTab("ocs")}><FileText size={14} /> OC emitidas</button></div>
      {intTab === "contratistas" ? (<>
        {pay.list.length === 0 && <div className="crep"><div className="empty">Aún no hay ítems con costo. Carga ítems en el editor.</div></div>}
        {pay.list.map((c) => (<ContractorCard key={c.key} c={c} overlay={contractors[c.key] || { hitos: [], adicionales: [] }} sections={sections} onSetReal={(iid, f, v) => setItemAny(iid, f, v)} onOpenOC={() => { setOcKey(c.key); setView("oc"); }} onLoadTypical={() => loadTypical(c.key)} onAddHito={() => addHito(c.key)} onSetHito={(id, f, v) => setHito(c.key, id, f, v)} onDelHito={(id) => delHito(c.key, id)} onAddAdic={() => addAdic(c.key)} onSetAdic={(id, f, v) => setAdic(c.key, id, f, v)} onDelAdic={(id) => delAdic(c.key, id)} />))}
      </>) : intTab === "partidas" ? (<ResguardoView pa2={partidaAccounts(sections, eParams, contractors)} contractors={contractors} pay={pay} onAddExtra={addExtraPartida} />) : intTab === "caja" ? (<CashFlowView cf={cashFlow(meta, cierre.cierreBs, partidaAccounts(sections, eParams, contractors), pa, contractors, informe, computeAvance(sections, eParams, informe.avances).global)} meta={meta} rate={rateCli} sym={meta.moneda === "US$" ? "US$" : "Bs"} />) : intTab === "balance" ? (<EstadoCuentas pa={pa} />) : (<OCRepo ordenes={libOrdenes} onOpen={(o) => { setOcDoc(o); setView("ocdoc"); }} onDelete={delOC} />)}
      <p className="foot">Cotizado = base del precio al cliente. Contratado = lo que realmente pagas (editable). La diferencia es tu margen/resguardo. Vista privada.</p>
      {modals}
    </div>);
  }

  /* ===== HUB (pantalla de inicio) ===== */
  if (view === "hub") {
    const hubCard = (accent) => ({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, textAlign: "left", background: "var(--surface)", border: accent ? "2px solid var(--accent)" : "1px solid var(--line2)", borderRadius: 12, padding: 14, cursor: "pointer", font: "inherit" });
    const rowList = (list, onPick, empty) => list == null
      ? <div className="empty" style={{ padding: 18 }}>Cargando…</div>
      : list.length === 0
        ? <div className="empty" style={{ padding: 18 }}>{empty}</div>
        : (<div style={{ border: "1px solid var(--line2)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
            {list.map((q, i) => { const ec = estadoColor(q.estado); return (
              <div key={q.id} onClick={() => onPick(q.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--accent-ink)", minWidth: 128 }}>{q.codigo}{q.version > 1 ? " · V" + pad2(q.version) : ""}</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{q.proyecto || q.nombre || "Sin proyecto"}{q.cliente ? <span style={{ color: "var(--muted)" }}> · {q.cliente}</span> : null}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: ec.bg, color: ec.fg, whiteSpace: "nowrap" }}>{q.estado || "Cotizada"}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 62, textAlign: "right" }}>{q.fecha || ""}</span>
                <ChevronRight size={16} color="var(--muted)" />
              </div>); })}
          </div>);
    return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
      <div className="menubar no-print" style={{ justifyContent: "space-between" }}>
        <span className="mb-brand"><span className="mb-logochip"><img src={DEFAULT_MINILOGO} alt="OG" /></span> Cotizador · Obra</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 10 }}>
          <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>{user.nombre}</span>
          <button className="btn sm" onClick={onChangeService}><ArrowLeft size={13} /> Cambiar servicio</button>
        </div>
      </div>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "12px 14px 44px" }}>
        {hubMode ? (<div>
          <button className="btn sm" style={{ marginBottom: 12 }} onClick={() => setHubMode(null)}><ArrowLeft size={14} /> Volver</button>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>{hubMode === "version" ? "Elegí la cotización para crear su nueva versión (V02…)" : "Elegí la cotización a copiar como base"}</h2>
          {rowList(hubList, hubMode === "version" ? hubVersion : hubDuplicar, "No hay cotizaciones guardadas todavía.")}
        </div>) : (<>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "8px 0 14px" }}>¿Qué querés hacer?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {perms.edit && <button onClick={hubNueva} style={hubCard(true)}><FilePlus2 size={22} color="var(--accent-ink)" /><div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>Nueva cotización</div><div style={{ fontSize: 12, color: "var(--muted)" }}>En blanco, correlativo nuevo</div></button>}
            {perms.edit && <button onClick={() => setHubMode("version")} style={hubCard(false)}><Layers size={22} color="var(--ink2)" /><div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>Nueva versión</div><div style={{ fontSize: 12, color: "var(--muted)" }}>V02 de una existente</div></button>}
            {perms.edit && <button onClick={() => setHubMode("dup")} style={hubCard(false)}><Copy size={22} color="var(--ink2)" /><div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>Partir de otra</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Copia con código nuevo</div></button>}
            {perms.edit && <button onClick={() => impQuoteRef.current && impQuoteRef.current.click()} style={hubCard(false)}><Upload size={22} color="var(--ink2)" /><div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>Importar</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Archivo .ogq.json</div></button>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "22px 0 8px" }}>
            <Pencil size={15} color="var(--muted)" /><span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>Seguir editando</span><span style={{ fontSize: 12, color: "var(--muted)" }}>— últimas 5</span>
          </div>
          {rowList(hubList ? hubList.slice(0, 5) : null, hubOpen, "Aún no hay cotizaciones guardadas. Empezá con «Nueva cotización».")}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn sm" onClick={openLoad}><Search size={14} /> Ver todas / buscar</button>
            {perms.ejecutivo && <button className="btn sm" onClick={openEmpresa}><Building2 size={14} /> Panel Empresa</button>}
          </div>
        </>)}
      </div>
      <input ref={impQuoteRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; importQuote(f); e.target.value = ""; }} />
      {modals}
      {toast && <div className="toast">{toast}</div>}
    </div>);
  }

  /* ===== EDITOR ===== */
  const logo = meta.logo || DEFAULT_LOGO;
  return (<div className="app" lang="es" spellCheck={true}><style>{CSS}</style>
    <div className="menubar no-print">
      <span className="mb-brand"><span className="mb-logochip"><img src={DEFAULT_MINILOGO} alt="OG" /></span> Cotizador</span>
      <div className="mb-item">
        <button className={"mb-top" + (menu === "archivo" ? " on" : "")} onClick={() => setMenu(menu === "archivo" ? null : "archivo")}>Archivo</button>
        {menu === "archivo" && (<div className="mb-drop">
          {perms.edit && <button className="mi" onClick={() => { setMenu(null); newQuote(); }}><FilePlus2 size={13} /> Nueva cotización</button>}
          <button className="mi" onClick={() => { setMenu(null); openLoad(); }}><FolderOpen size={13} /> Abrir…</button>
          <button className="mi" onClick={() => { setMenu(null); setModal("revision"); }}><ClipboardList size={13} /> Revisar antes de enviar</button>
          {perms.edit && <button className="mi" onClick={() => { setMenu(null); openSave(); }}><Save size={13} /> Guardar</button>}
          {perms.edit && <button className="mi" onClick={() => { setMenu(null); if (editingId) duplicateQuote(editingId); else flash("Guarda primero la cotización para poder copiarla"); }}><FilePlus2 size={13} /> Crear copia (nuevo código)</button>}
          {perms.edit && <button className="mi" onClick={() => { setMenu(null); nuevaVersion(); }}><Layers size={13} /> Nueva versión (V{String((meta.version || 1) + 1).padStart(2, "0")}) — mismo código</button>}
          {perms.edit && editingId && !meta.esAdicional && <button className="mi" onClick={() => { setMenu(null); nuevoAdicional(); }}><Plus size={13} /> Nuevo adicional</button>}
          <div className="mb-div" />
          <div className="mi has-sub"><span style={{ display: "flex", alignItems: "center", gap: 9, flex: 1 }}><Download size={13} /> Exportar</span><ChevronRight size={13} />
            <div className="mb-subdrop">
              <button className="mi" onClick={() => { setMenu(null); exportQuote(); }}><FilePlus2 size={13} /> esta cotización (.json)</button>
              <button className="mi" onClick={() => { setMenu(null); exportExcel(); }}><FileText size={13} /> a Excel (.xls)</button>
              <button className="mi" onClick={() => { setMenu(null); doExport("pdf"); }}><Printer size={13} /> a PDF</button>
              <button className="mi" onClick={() => { setMenu(null); doExport("png"); }}><Eye size={13} /> a Imagen (PNG)</button>
            </div>
          </div>
          {perms.backup && <button className="mi" onClick={() => { setMenu(null); exportBase(); }}><Download size={13} /> Exportar base (.json)…</button>}
          {perms.edit && <button className="mi" onClick={() => { setMenu(null); impQuoteRef.current && impQuoteRef.current.click(); }}><FolderOpen size={13} /> Importar cotización…</button>}
          {perms.backup && <button className="mi" onClick={() => { setMenu(null); importRef.current && importRef.current.click(); }}><FolderOpen size={13} /> Importar base…</button>}
          <div className="mb-div" />
          <button className="mi" onClick={() => { setMenu(null); setView("cliente"); }}><Eye size={13} /> Vista cliente / PDF</button>
        </div>)}
      </div>
      <div className="mb-item">
        <button className={"mb-top" + (menu === "ver" ? " on" : "")} onClick={() => setMenu(menu === "ver" ? null : "ver")}>Ver</button>
        {menu === "ver" && (<div className="mb-drop">
          <button className="mi" onClick={() => { setMenu(null); undo(); }}><ArrowLeft size={13} /> Deshacer (Ctrl+Z)</button>
          <button className="mi" onClick={() => { setMenu(null); setView("editor"); }}><Pencil size={13} /> Editor</button>
          <button className="mi" onClick={() => { setMenu(null); setView("cliente"); }}><Eye size={13} /> Vista cliente</button>
          {perms.ejecutivo && <button className="mi" onClick={() => { setMenu(null); setView("resumen"); }}><TrendingUp size={13} /> Resumen ejecutivo</button>}
          {perms.ejecutivo && <button className="mi" onClick={() => { setMenu(null); openEmpresa(); }}><Layers size={13} /> Panel empresa</button>}
          {perms.interno && <button className="mi" onClick={() => { setMenu(null); setView("interno"); }}><ClipboardList size={13} /> Control interno</button>}
          {(perms.edit || perms.interno) && <button className="mi" onClick={() => { setMenu(null); setView("informe"); }}><FileText size={13} /> Informe de avance</button>}
        </div>)}
      </div>
      <div className="mb-item">
        <button className={"mb-top" + (menu === "herr" ? " on" : "")} onClick={() => setMenu(menu === "herr" ? null : "herr")}>Herramientas</button>
        {menu === "herr" && (<div className="mb-drop">
          {perms.edit && <button className="mi" onClick={() => { setMenu(null); limpiarTextos(); }}><Pencil size={13} /> Corregir textos (formato)</button>}
          {(perms.config || perms.cotizacion) && <button className="mi" onClick={() => { setMenu(null); setShowParams(true); }}><Settings2 size={13} /> Parámetros de cotización</button>}
          {perms.proveedores && <button className="mi" onClick={() => { setMenu(null); openLibManage(); }}><BookOpen size={13} /> Biblioteca de precios</button>}
          {perms.proveedores && <button className="mi" onClick={() => { setMenu(null); openBookManage(); }}><Users size={13} /> Libreta de contratistas</button>}
          {perms.backup && <button className="mi" onClick={() => { setMenu(null); setModal("backup"); }}><Download size={13} /> Respaldo y autoguardado</button>}
          {perms.usuarios && <button className="mi" onClick={() => { setMenu(null); setModal("usuarios"); }}><Users size={13} /> Usuarios y permisos</button>}
        </div>)}
      </div>
      <span style={{ flex: 1 }} />
      <span className="mb-user">{user.nombre}</span>
    </div>
    {menu && <div className="mb-overlay no-print" onClick={() => setMenu(null)} />}
    {updateAvail && <div className="ro-banner no-print" style={{ background: "#EAF0FB", borderColor: "#B9CCEC", color: "#2C4E8A", cursor: "pointer" }} onClick={() => location.reload()}><Download size={14} /> Hay una <b>nueva versión</b> disponible. Haz clic aquí para actualizar.</div>}
    {tcBCB && tcBCB.valor > 0 && editingId && Math.abs(num(params.tcOficial) - tcBCB.valor) > 0.0001 && !ro && (
      <div className="ro-banner no-print" style={{ background: "#FBF4E9", borderColor: "#E6D3AE", color: "var(--warn)" }}>
        <DollarSign size={14} /> <span>TC oficial BCB{tcBCB.fecha ? " (" + tcBCB.fecha + ")" : ""}: <b>Bs {fmt(tcBCB.valor)}</b> · esta cotización usa <b>Bs {fmt(params.tcOficial)}</b>.</span>
        <button className="btn sm" style={{ marginLeft: "auto" }} onClick={aplicarTCBCB}>Aplicar</button>
      </div>)}
    <fieldset className="rofs" disabled={ro}>
    <div className="titleblock">
      <div className="tb-top">
        <div className="logo-box" onClick={() => logoInput.current?.click()} title="Cambiar logo"><img className="logo-img" src={logo} alt="logo" /><span className="logo-hint no-print">CAMBIAR</span></div>
        <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogoFile} />
        <div style={{ flex: 1 }}><h1>COTIZACIÓN DE OBRA</h1><div className="sub">Presupuesto · estructura de costos</div></div>
      </div>
      <div className="tb-grid">
        <TBCell label="Código cotización" val={meta.codigo} on={(v) => { setM("codigo", v); syncCorrelativo(v); }} ph="OCS_CON_001_26" />
        <TBCell label="Cliente" val={meta.cliente} on={(v) => setM("cliente", v)} ph="Nombre del cliente" />
        <TBCell label="Proyecto" val={meta.proyecto} on={(v) => setM("proyecto", v)} ph="Nombre del proyecto" />
        <TBCell label="Ubicación" val={meta.ubicacion} on={(v) => setM("ubicacion", v)} ph="Zona / dirección" />
        <TBCell label="Sup. m²" val={meta.superficie} on={(v) => setM("superficie", v)} ph="0.00" />
        <TBCell label="Fecha" val={meta.fecha} on={(v) => setM("fecha", v)} ph="dd/mm/aaaa" />
        <div className="tb-cell"><label>Moneda al cliente</label><select value={meta.moneda} onChange={(e) => setM("moneda", e.target.value)}><option value="Bs">Bs (Bolivianos)</option><option value="US$">US$ (Dólares)</option></select></div>
        {meta.moneda === "US$" && <div className="tb-cell"><label>TC para dolarizar</label><input inputMode="decimal" value={meta.tcCliente ?? ""} placeholder={"Oficial " + fmt(params.tcOficial)} onChange={(e) => setM("tcCliente", e.target.value)} /></div>}
        <TBCell label="Plazo de ejecución (días háb.)" val={meta.plazoEjecucion} on={(v) => setM("plazoEjecucion", v)} ph="Ej. 30" />
        <div className="tb-cell"><label>Estado del proyecto</label><select value={meta.estado || "Cotizada"} onChange={(e) => setM("estado", e.target.value)}><option value="Cotizada">Cotizada</option><option value="Adjudicada">Adjudicada</option><option value="En ejecución">En ejecución</option><option value="Cerrada">Cerrada</option></select></div>
      </div>
      <div className="fp-edit no-print">
        <div className="fp-head"><Wallet size={14} color="var(--accent-ink)" /><b>Forma de pago</b><span style={{ color: "var(--muted)", fontWeight: 400 }}>— se muestra al final de la oferta</span>
          {(meta.pagos || []).length === 0 && <button className="btn sm" style={{ marginLeft: "auto" }} onClick={loadTypicalPagos}>Cargar 50/50</button>}</div>
        {(meta.pagos || []).map((h, i) => { const monto = cierre.cierreBs * num(h.pct) / 100; return (<div className="fp-row" key={h.id}>
          <span className="fp-n">{i + 1}</span>
          <input className="fld" style={{ flex: 1, minWidth: 140 }} value={h.detalle} placeholder="Ej. Anticipo a la firma del contrato" onChange={(e) => setPago(h.id, "detalle", e.target.value)} />
          <input className="fld num" style={{ width: 60 }} inputMode="decimal" value={h.pct} placeholder="0" onChange={(e) => setPago(h.id, "pct", e.target.value)} />
          <span style={{ fontSize: 11 }}>%</span>
          <span className="mono" style={{ minWidth: 92, textAlign: "right", fontWeight: 700 }}>Bs {fmt(monto)}</span>
          <input className="fld" type="date" style={{ width: 138 }} value={h.fechaEst || ""} title="Fecha estimada de cobro" onChange={(e) => setPago(h.id, "fechaEst", e.target.value)} />
          <button className={"toggle " + (h.cobrado ? "paid" : "pending")} onClick={() => setPago(h.id, "cobrado", !h.cobrado)}>{h.cobrado ? "Cobrado" : "Por cobrar"}</button>
          {h.cobrado && <input className="fld" type="date" style={{ width: 138 }} value={h.fechaReal || ""} title="Fecha real de cobro" onChange={(e) => setPago(h.id, "fechaReal", e.target.value)} />}
          <button className="iconbtn" onClick={() => delPago(h.id)}><Trash2 size={14} /></button>
        </div>); })}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={addPago}><Plus size={13} /> Agregar hito de pago</button>
          {(meta.pagos || []).length > 0 && (() => { const sum = (meta.pagos || []).reduce((a, x) => a + num(x.pct), 0); return <span style={{ fontSize: 11.5, fontWeight: 700, color: Math.abs(sum - 100) < 0.01 ? "var(--good)" : "var(--warn)" }}>Suma: {fmt(sum)}%{Math.abs(sum - 100) < 0.01 ? " ✓" : " (debe sumar 100%)"}</span>; })()}
        </div>
      </div>
    </div>

    </fieldset>
    <div className="userbar no-print">
      <span className="ub-av" style={{ background: ROLES[user.rol].color }}>{initials(user.nombre)}</span>
      <span className="ub-meta"><b>{user.nombre}</b><span className={"rolechip " + ROLES[user.rol].chip}>{ROLES[user.rol].label}</span></span>
      <span style={{ flex: 1 }} />
      {OG_API && (online && pendCount === 0
        ? <span className="netbadge on" title="Conectado al NAS"><i /> En línea</span>
        : <button className="netbadge off" onClick={syncNow} title="Reintentar sincronización">{online ? <><i style={{ background: "var(--warn)" }} /> {pendCount} por sincronizar</> : <><i style={{ background: "var(--bad)" }} /> Sin conexión{pendCount ? " · " + pendCount : ""}</>}</button>)}
      {perms.usuarios && <button className="btn sm" onClick={() => setModal("usuarios")}><Users size={13} /> Usuarios</button>}
      <button className="btn sm" onClick={async () => { await releaseEditing(); onChangeService(); }}>Cambiar servicio</button>
      <button className="btn sm" onClick={async () => { await releaseEditing(); onChangeUser(); }}>Cambiar usuario</button>
    </div>
    <div className="doctabs no-print">
      {docTabs.map((t) => { const lbl = t.id === activeDoc ? docLabel() : ((docsRef.current[t.id] && docsRef.current[t.id].meta && (docsRef.current[t.id].meta.codigo + (docsRef.current[t.id].meta.proyecto ? " · " + docsRef.current[t.id].meta.proyecto.slice(0, 18) : ""))) || "Cotización"); return (
        <div className={"doctab" + (t.id === activeDoc ? " on" : "")} key={t.id} onClick={() => switchDoc(t.id)}><span className="dt-lbl">{lbl}</span>{docTabs.length > 1 && <button className="dt-x" onClick={(e) => closeDocTab(t.id, e)}>×</button>}</div>); })}
      <button className="doctab-add" onClick={newDocTab} title="Nueva cotización en pestaña">＋</button>
    </div>
    {lockRO ? <div className="ro-banner" style={{ background: "#FBECEC", borderColor: "#E6B8B8", color: "var(--bad)" }}><Eye size={14} /> <b>{lockedBy}</b> está editando este documento. Estás en modo visualización; no puedes guardar cambios.</div>
      : refRO ? <div className="ro-banner" style={{ background: "#F3F1EC" }}><Eye size={14} /> <b>Referencia · solo lectura.</b> Esta cotización está abierta para consulta visual; no se edita ni se bloquea.</div>
      : roBase ? <div className="ro-banner"><Eye size={14} /> Modo solo lectura — puedes consultar y extraer datos, pero no editar cotizaciones.</div>
        : editingId ? <div className="ro-banner" style={{ background: "#EAF4EE", borderColor: "#BFE0CB", color: "var(--good)" }}><Pencil size={14} /> Editando <b>{meta.codigo}</b> · bloqueado para otros mientras trabajas.</div> : null}
    <datalist id="units-dl">{[...new Set([...UNITS, ...sections.flatMap((s) => s.items.map((i) => i.unidad)).filter(Boolean)])].map((u) => <option key={u} value={u} />)}</datalist>

    {/* Dólar oficial BCB — visible y editable para TODOS los usuarios, sin importar el permiso */}
    <div className="tcbcb-row no-print" style={{ marginTop: 10, marginBottom: 4 }}>
      <DollarSign size={15} color="var(--good)" />
      <span style={{ fontWeight: 700, color: "var(--ink)" }}>Dólar oficial (BCB)</span>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>TC en uso:
        <input className="mono" inputMode="decimal" value={params.tcOficial ?? ""} onChange={(e) => setP("tcOficial", e.target.value)} style={{ width: 80, textAlign: "right", padding: "3px 7px", border: "1px solid var(--line2)", borderRadius: 5, fontSize: 12.5 }} />
        <span>Bs</span>
      </label>
      {tcBCB && tcBCB.valor > 0
        ? (<span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>· BCB hoy <b>Bs {fmt(tcBCB.valor)}</b>{tcBCB.fecha ? <span style={{ color: "var(--muted)" }}>({tcBCB.fecha})</span> : null}
            {Math.abs(num(params.tcOficial) - tcBCB.valor) > 0.0001 && <button className="btn sm" onClick={aplicarTCBCB}>Aplicar</button>}
            <button className="btn sm ghost" onClick={refrescarTCBCB}>Actualizar</button></span>)
        : (<button className="btn sm ghost" onClick={refrescarTCBCB}>Consultar BCB</button>)}
    </div>
    <div className="toolbar">
      {(perms.config || perms.cotizacion) && <button className="btn" onClick={() => setShowParams((s) => !s)}><Settings2 size={14} /> Parámetros</button>}
      <button className="btn primary" onClick={() => setView("cliente")}><Eye size={14} /> Vista cliente</button>
      {perms.ejecutivo && <button className="btn" onClick={() => setView("resumen")}><TrendingUp size={14} /> Resumen</button>}
      {perms.ejecutivo && <button className="btn" onClick={openEmpresa}><Layers size={14} /> Panel empresa</button>}
      {perms.interno && <button className="btn" onClick={() => setView("interno")}><ClipboardList size={14} /> Control interno</button>}
      {(perms.edit || perms.interno) && <button className="btn" onClick={() => setView("informe")}><FileText size={14} /> Informe avance</button>}
      {perms.proveedores && <button className="btn" onClick={openLibManage}><BookOpen size={14} /> Biblioteca</button>}
      {perms.proveedores && <button className="btn" onClick={openBookManage}><Users size={14} /> Libreta</button>}
      {perms.edit && <button className="btn" onClick={openSave}><Save size={14} /> Guardar</button>}
      <button className="btn" onClick={openLoad}><FolderOpen size={14} /> Cargar</button>
      {perms.backup && <button className="btn" onClick={() => setModal("backup")}><Download size={14} /> Respaldo</button>}
      {perms.edit && <button className="btn ghost" onClick={newQuote}><FilePlus2 size={14} /> Nueva</button>}
      {perms.edit && editingId && !meta.esAdicional && <button className="btn" onClick={nuevoAdicional} title="Crear orden de servicios adicional ligada a esta obra"><Plus size={14} /> Nuevo adicional</button>}
      <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; importBase(f); e.target.value = ""; }} />
      <input ref={impQuoteRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; importQuote(f); e.target.value = ""; }} />
    </div>
    <fieldset className="rofs" disabled={ro}>

    {showParams && (perms.config || perms.cotizacion) && (
      <div className="panel">
        <div className="sec-head" style={{ cursor: "default" }}><Calculator size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Parámetros de cotización</span></div>
        <div className="psub"><div className="psub-t">Tasas seleccionables por ítem</div>
          <div className="optrow"><span className="ol">Gastos generales</span><div className="optbox">{params.ggOptions.map((o, i) => <input key={i} className="mono" inputMode="decimal" value={o} onChange={(e) => setOpt("ggOptions", i, e.target.value)} />)}</div><span className="psuf">%</span></div>
          <div className="optrow"><span className="ol">Utilidad</span><div className="optbox">{params.utilOptions.map((o, i) => <input key={i} className="mono" inputMode="decimal" value={o} onChange={(e) => setOpt("utilOptions", i, e.target.value)} />)}</div><span className="psuf">%</span></div>
          <div className="defrow"><label>Ítems nuevos usan GG:<select className="psel" value={params.ggDefault} onChange={(e) => setP("ggDefault", num(e.target.value))}>{params.ggOptions.map((o, i) => <option key={i} value={o}>{o}%</option>)}</select></label><label>y Utilidad:<select className="psel" value={params.utilDefault} onChange={(e) => setP("utilDefault", num(e.target.value))}>{params.utilOptions.map((o, i) => <option key={i} value={o}>{o}%</option>)}</select></label></div>
        </div>
        <div className="psub"><div className="psub-t">Tipo de cambio</div>
          <div className="params"><PCell label="TC oficial" v={params.tcOficial} on={(v) => setP("tcOficial", v)} suf="Bs" /><PCell label="TC real / paralelo" v={params.tcReal} on={(v) => setP("tcReal", v)} suf="Bs" /></div>
          <div className="tc-note">TC oficial flexible del BCB (RD 88/2026): se publica cada día hábil a las 20:00 y rige el día hábil siguiente.</div>
          {tcBCB && tcBCB.valor > 0 && (<div className="tcbcb-row no-print">
            <span><b>BCB hoy: Bs {fmt(tcBCB.valor)}</b>{tcBCB.venta ? <span style={{ color: "var(--muted)" }}> · venta tope Bs {fmt(tcBCB.venta)}</span> : null}{tcBCB.fecha ? <span style={{ color: "var(--muted)" }}> · corte {tcBCB.fecha}</span> : null}</span>
            <button className="btn sm" onClick={aplicarTCBCB}>Aplicar</button>
            <button className="btn sm ghost" onClick={refrescarTCBCB}>Actualizar</button>
          </div>)}
        </div>
        {perms.config && (<div className="psub"><div className="psub-t">Impuestos del modelo (solo CEO)</div>
          <div className="params"><PCell label="IVA" v={params.ivaPct} on={(v) => setP("ivaPct", v)} suf="%" /><PCell label="IT" v={params.itPct} on={(v) => setP("itPct", v)} suf="%" /><PCell label="IUE" v={params.iuePct} on={(v) => setP("iuePct", v)} suf="%" /><PCell label="GG con crédito fiscal" v={params.ggCredPct} on={(v) => setP("ggCredPct", v)} suf="%" /></div>
        </div>)}
        <div className="psub"><div className="psub-t">Incidencias a prorratear (camufladas en el precio)</div>
          {(params.incidencias || []).length === 0 && <div className="incid-empty">Sin incidencias. Agrega costos que quieras camuflar en el precio (fotógrafo, supervisor, comisión inmobiliaria…).</div>}
          {(params.incidencias || []).map((x, i) => { const amt = ib.items.find((z) => z.id === x.id); return (<div className="incid-row" key={x.id}>
            <input className="fld" style={{ flex: 1, minWidth: 120 }} value={x.nombre} placeholder={`Incidencia ${i + 1} (ej. Fotógrafo)`} onChange={(e) => setIncid(x.id, "nombre", e.target.value)} />
            <input className="fld num" style={{ width: 78 }} inputMode="decimal" value={x.valor} placeholder="0" onChange={(e) => setIncid(x.id, "valor", e.target.value)} />
            <select className="psel" value={x.tipo} onChange={(e) => setIncid(x.id, "tipo", e.target.value)}><option value="fijo">Bs (fijo)</option><option value="pct">% del total</option></select>
            <label className="incid-mk">GG<select value={x.gg ?? params.ggDefault} onChange={(e) => setIncid(x.id, "gg", num(e.target.value))}>{params.ggOptions.map((o, j) => <option key={j} value={o}>{o}%</option>)}</select></label>
            <label className="incid-mk">Util<select value={x.util ?? params.utilDefault} onChange={(e) => setIncid(x.id, "util", num(e.target.value))}>{params.utilOptions.map((o, j) => <option key={j} value={o}>{o}%</option>)}</select></label>
            <span className="incid-amt mono">Bs {fmt(amt ? amt.montoBs : 0)}</span>
            <button className="iconbtn no-print" onClick={() => delIncid(x.id)} title="Quitar"><Trash2 size={14} /></button>
          </div>); })}
          <button className="btn sm no-print" style={{ marginTop: 8 }} onClick={addIncid}><Plus size={13} /> Agregar incidencia</button>
          {ib.totalCosto > 0.005 && (<div className="incid-info">Costo de incidencias: <b>Bs {fmt(ib.totalCosto)}</b> (lo que pagas). Con su GG, utilidad e impuestos, elevan el precio al cliente en <b>Bs {fmt(ib.S)}</b>, repartido proporcionalmente en cada ítem y <b>invisible</b> para el cliente. Factor de venta aplicado: <b>×{ib.m.toFixed(4)}</b>.</div>)}
        </div>
        <div className="psub"><div className="psub-t">Descuentos al cliente</div>
          <div className="incid-empty">Los descuentos y el precio de cierre se gestionan en el panel <b>“Descuentos y cierre comercial”</b>, al final del editor, junto a los totales.</div>
        </div>
      </div>
    )}

    <div className="note no-print"><Info size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>Usa las flechas de cada ítem para reordenar (los códigos se renumeran solos) y <b>＋</b> para insertar uno debajo. Carga ítems desde la <b>Biblioteca</b> y contratistas desde la <b>Libreta</b>.</span></div>

    <div className="grplabels no-print">
      <span className="gl-t">Grupos:</span>
      <label className="gl a"><i /> A ·<input value={meta.grupoALabel || ""} placeholder="Arquitectura" onChange={(e) => setM("grupoALabel", e.target.value)} /></label>
      <label className="gl b"><i /> B ·<input value={meta.grupoBLabel || ""} placeholder="Ingenierías" onChange={(e) => setM("grupoBLabel", e.target.value)} /></label>
      <label className="gl c"><i /> C ·<input value={meta.grupoCLabel || ""} placeholder="Terceros" onChange={(e) => setM("grupoCLabel", e.target.value)} /></label>
      <span className="gl-hint">Asigna cada partida con A/B/C. Grupo C = globales de terceros (informativo).</span>
      <span style={{ flex: 1 }} />
      <div className="col-ctrls no-print">
        <span className="cc-lb">Plegar:</span>
        <button className="cc-b a" onClick={() => toggleGrupo("A")} title="Plegar/desplegar todas las partidas del Grupo A">A</button>
        <button className="cc-b b" onClick={() => toggleGrupo("B")} title="Plegar/desplegar todas las partidas del Grupo B">B</button>
        <button className="cc-b c" onClick={() => toggleGrupo("C")} title="Plegar/desplegar todas las partidas del Grupo C">C</button>
        <button className="cc-b" onClick={toggleTodo} title="Plegar/desplegar todas las partidas">Todo</button>
        <button className="cc-b" onClick={comprimirTodosItems} title="Comprimir/expandir todos los ítems">Ítems</button>
      </div>
    </div>

    {sections.map((sec, si) => {
      const isC = sec.grupo === "C";
      const st = isC ? sec.items.reduce((a, it) => a + num(it.monto), 0) : sec.items.reduce((a, it) => a + computeItem(it, eParams).total, 0);
      const open = !collapsed[sec.id];
      return (<div className={"panel" + (isC ? " panelC" : "")} key={sec.id}
        onDragOver={(e) => { if (dragSecRef.current != null) e.preventDefault(); }}
        onDrop={(e) => { if (dragSecRef.current != null) { e.preventDefault(); reorderSections(dragSecRef.current, si); dragSecRef.current = null; } }}>
        <div className="sec-head" onClick={() => setCollapsed((c) => ({ ...c, [sec.id]: !c[sec.id] }))}>
          {!ro && <span className="drag-h no-print" draggable onDragStart={(e) => { dragSecRef.current = si; e.stopPropagation(); }} onDragEnd={() => { dragSecRef.current = null; }} onClick={(e) => e.stopPropagation()} title="Arrastra para reordenar la partida">⠿</span>}
          {open ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
          <span className="sec-no">{si + 1}.0</span>
          <input className="sec-name" value={sec.nombre} onClick={(e) => e.stopPropagation()} onChange={(e) => setSecName(sec.id, e.target.value)} />
          <div className="grp-toggle no-print" onClick={(e) => e.stopPropagation()} title="A: Arquitectura · B: Ingenierías · C: Terceros (informativo)">
            <button className={"a" + (sec.grupo !== "B" && sec.grupo !== "C" ? " on" : "")} onClick={() => setSectionGroup(sec.id, "A")}>A</button>
            <button className={"b" + (sec.grupo === "B" ? " on" : "")} onClick={() => setSectionGroup(sec.id, "B")}>B</button>
            <button className={"c" + (sec.grupo === "C" ? " on" : "")} onClick={() => setSectionGroup(sec.id, "C")}>C</button>
          </div>
          <span className="sec-sub">Bs {fmt(st)}</span>
          {!isC && sec.items.length > 0 && <button className="iconbtn no-print" title="Comprimir / expandir los ítems de esta partida" onClick={(e) => { e.stopPropagation(); const anyOpen = sec.items.some((it) => !itemsCol[it.id]); setSecItems(sec, anyOpen); }}><Layers size={14} /></button>}
          <button className="iconbtn no-print" onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar esta partida completa?")) delSection(sec.id); }}><Trash2 size={15} /></button>
        </div>
        {open && (isC ? (<>
          <div className="cinfo-note no-print">Grupo C · terceros: globales trasladados de la oferta del proveedor. Solo informativo — no lleva tu markup ni impuestos, pero se suma a la inversión total del cliente.</div>
          {sec.items.map((it, ii) => (<div className="crow" key={it.id}>
            <input className="fld" style={{ flex: 1, minWidth: 140 }} value={it.descripcion} placeholder="Concepto (ej. Mobiliario de línea)" onChange={(e) => setItem(sec.id, it.id, "descripcion", e.target.value)} />
            <input className="fld num" style={{ width: 130 }} inputMode="decimal" value={it.monto || ""} placeholder="Monto Bs" onChange={(e) => setItem(sec.id, it.id, "monto", e.target.value)} />
            <button className="iconbtn no-print" onClick={() => delItem(sec.id, it.id)}><Trash2 size={15} /></button>
          </div>))}
          <div style={{ padding: "10px 13px" }} className="no-print"><button className="linkbtn" onClick={() => addItem(sec.id)}><Plus size={14} /> Agregar ítem de tercero</button></div>
        </>) : (<>
          {sec.items.map((it, ii) => (<ItemRow key={it.id} no={`${si + 1}.${ii + 1}`} it={it} params={eParams} first={ii === 0} last={ii === sec.items.length - 1} suggestions={libFlat}
            onSet={(k, v) => setItem(sec.id, it.id, k, v)} onSetC={(k, v) => setContractor(sec.id, it.id, k, v)} onDel={() => delItem(sec.id, it.id)} ctSuggestions={libCts} onFillCt={(o) => setContractorAll(sec.id, it.id, o)}
            onMove={(d) => moveItem(sec.id, ii, d)} onInsert={() => insertItem(sec.id, ii + 1)}
            compact={!!itemsCol[it.id]} onToggleCompact={() => toggleItemCol(it.id)} onDragStartRow={() => { dragItemRef.current = { sid: sec.id, idx: ii }; }} onDropRow={() => { const d = dragItemRef.current; if (d && d.sid === sec.id) reorderItems(sec.id, d.idx, ii); dragItemRef.current = null; }} dragActive={!ro} onSaveLib={() => openSaveItem({ descripcion: it.descripcion, unidad: it.unidad, puDirecto: it.puDirecto })}
            onPickCt={() => openBookForItem(sec.id, it.id)} onSaveCt={() => openSaveCt(it.contratista || {})} />))}
          <div style={{ padding: "10px 13px", display: "flex", gap: 14 }} className="no-print">
            <button className="linkbtn" onClick={() => addItem(sec.id)}><Plus size={14} /> Agregar ítem</button>
            <button className="linkbtn" onClick={() => openLibForSection(sec.id)}><BookOpen size={13} /> Desde biblioteca</button>
          </div>
        </>))}
      </div>);
    })}

    <div className="no-print" style={{ marginBottom: 14 }}><button className="btn" onClick={addSection}><Plus size={14} /> Agregar partida</button></div>

    <div className="summary">
      <div className="sum-hero"><div><div className="eyebrow" style={{ color: "#8E9AB3" }}>Precio de venta al cliente</div><div className="big">Bs {fmt(totals.total)}</div><div className="usd">US$ {fmt(totals.total / params.tcOficial)} oficial · US$ {fmt(totals.total / params.tcReal)} real</div></div></div>
      {(totals.grpA > 0.005 && totals.grpB > 0.005) && (<div className="grpsplit">
        <div className="gs a"><div className="lb"><i /> Grupo A · {meta.grupoALabel || "Arquitectura"}</div><div className="vl">Bs {fmt(totals.grpA)}</div></div>
        <div className="gs b"><div className="lb"><i /> Grupo B · {meta.grupoBLabel || "Ingenierías"}</div><div className="vl">Bs {fmt(totals.grpB)}</div></div>
      </div>)}
      {totals.grpC > 0.005 && (<div className="csum-bar"><div><span className="cs-lb">Grupo C · {meta.grupoCLabel || "Terceros"}</span><span className="cs-note">informativo · contratación directa del cliente</span></div><div className="cs-vl">Bs {fmt(totals.grpC)}</div></div>)}
      {totals.grpC > 0.005 && (<div className="cinv-bar"><span>Inversión total del cliente (tu oferta + terceros)</span><b>Bs {fmt(totals.total + totals.grpC)}</b></div>)}
      {perms.ejecutivo && (<><div className="sum-grid"><SCell k="Costo directo" v={"Bs " + fmt(totals.cd)} /><SCell k="Gastos generales" v={"Bs " + fmt(totals.ggBs)} /><SCell k="IVA neto" v={"Bs " + fmt(totals.ivaNeto)} /><SCell k="IT" v={"Bs " + fmt(totals.itBs)} /></div>
      <div className="gauge">
        <div className="gauge-h"><span className="t">Tu utilidad: nominal vs. real</span><span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#8E9AB3" }}>s/ costo directo</span></div>
        <div className="gauge-row"><div className="gauge-lab"><span className="name">Utilidad bruta (lo que parece)</span><span className="pct" style={{ color: "#9FB3CC" }}>{grossPct.toFixed(1)}%</span></div><div className="bar"><i style={{ width: `${Math.min(100, grossPct / gMax * 100)}%`, background: "#5B7799" }} /></div></div>
        <div className="gauge-row"><div className="gauge-lab"><span className="name">Utilidad neta real (después de IUE)</span><span className="pct" style={{ color: "#6FCF97" }}>{netPct.toFixed(1)}%</span></div><div className="bar"><i style={{ width: `${Math.min(100, netPct / gMax * 100)}%`, background: "#2E9E5B" }} /></div></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 11, paddingTop: 10, borderTop: "1px solid #3A3B3B" }}><span style={{ fontSize: 11.5, color: "#C7CFDC" }}>Utilidad neta en tu bolsillo</span><span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13.5, color: "#6FCF97" }}>Bs {fmt(totals.utilNeta)} · US$ {fmt(totals.utilNeta / params.tcReal)}</span></div>
      </div></>)}
    </div>
    <div className="panel no-print">
      <div className="sec-head" style={{ cursor: "default" }}><Wallet size={16} color="var(--accent-ink)" /><span style={{ fontWeight: 700, fontSize: 13.5 }}>Descuentos y cierre comercial</span><span className="sec-sub" style={{ marginLeft: "auto" }}>Bs {fmt(cierre.cierreBs)}</span></div>
      <div className="dc-note">Dos herramientas distintas: el <b>descuento aparente</b> se camufla en el precio (neto cero para ti) y el <b>cierre negociado</b> es un descuento real que sí baja tu utilidad.</div>
      <div className="fp-edit">
        <div className="fp-head"><DollarSign size={14} color="var(--accent-ink)" /><b>Cierre negociado</b><span style={{ color: "var(--muted)", fontWeight: 400 }}>— precio final acordado con el cliente</span></div>
        <div className="fp-row">
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Precio de lista</span>
          <span className="mono" style={{ fontWeight: 700 }}>Bs {fmt(listaBs)}</span>
          <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 10 }}>Cierre (Bs)</span>
          <input className="fld num" style={{ width: 110 }} inputMode="decimal" value={meta.precioCierre ?? ""} placeholder={fmt(listaBs)} onChange={(e) => setM("precioCierre", e.target.value)} />
          <select className="psel" value={meta.cierreModo || "visible"} onChange={(e) => setM("cierreModo", e.target.value)} title="Cómo se le muestra al cliente">
            <option value="visible">Mostrar descuento al final</option>
            <option value="prorrateado">Prorratear en los precios</option>
          </select>
          {cierre.activo && <button className="iconbtn" onClick={() => setM("precioCierre", "")} title="Quitar"><Trash2 size={14} /></button>}
        </div>
        {cierre.activo && (<div className={"tcbcb-row"} style={{ background: cierre.descBs >= 0 ? "#FBF4E9" : "#EAF4EE", borderColor: cierre.descBs >= 0 ? "#E6D3AE" : "#BFE0CB" }}>
          <span>{cierre.descBs >= 0 ? "Descuento comercial" : "Ajuste al alza"}: <b>Bs {fmt(Math.abs(cierre.descBs))}</b> ({fmt(Math.abs(cierre.pct))}%) · factor <b className="mono">{cierre.factor.toFixed(5)}</b></span>
          <span style={{ color: "var(--muted)" }}>{cierre.modo === "visible" ? "El cliente ve el descuento al final; internamente se prorratea." : "Prorrateado en cada precio unitario; el cliente no ve línea de descuento."}</span>
        </div>)}
      </div>
      <div style={{ padding: "0 13px 13px" }}>
        <div className="psub"><div className="psub-t">Créditos y descuentos al cliente (visibles, netos)</div>
          {(params.descuentos || []).length === 0 && <div className="incid-empty">Sin descuentos. Agrega créditos/descuentos que quieras mostrar al cliente (ej. crédito por diseño, descuento LUMA). Se camuflan primero en el precio y se restan visiblemente: neto para ti = cero.</div>}
          {(params.descuentos || []).map((x, i) => { const dd = disc.items.find((z) => z.id === x.id); return (<div className="incid-row" key={x.id}>
            <input className="fld" style={{ flex: 1, minWidth: 120 }} value={x.nombre} placeholder={`Descuento ${i + 1} (ej. Crédito diseño)`} onChange={(e) => setDesc(x.id, "nombre", e.target.value)} />
            <input className="fld num" style={{ width: 78 }} inputMode="decimal" value={x.valor} placeholder="0" onChange={(e) => setDesc(x.id, "valor", e.target.value)} />
            <select className="psel" value={x.tipo} onChange={(e) => setDesc(x.id, "tipo", e.target.value)}><option value="fijo">Bs (fijo)</option><option value="pct">% del subtotal</option></select>
            <span className="incid-amt mono">− Bs {fmt(dd ? dd.montoBs : 0)}</span>
            <button className="iconbtn no-print" onClick={() => delDesc(x.id)} title="Quitar"><Trash2 size={14} /></button>
          </div>); })}
          <button className="btn sm no-print" style={{ marginTop: 8 }} onClick={addDesc}><Plus size={13} /> Agregar descuento</button>
          {disc.hasDisc && (<div className="incid-info" style={{ background: "#EAF4EE", borderColor: "#BFE0CB", color: "var(--good)" }}>Al cliente se le muestra un subtotal inflado de <b>Bs {fmt(disc.S_shown)}</b>, se resta el descuento y el <b>precio final vuelve a tu proyección</b> (Bs {fmt(totals.total)}). Neto para ti: cero. Sin GG ni utilidad sobre el descuento.</div>)}
        </div>
      </div>
    </div>
    </fieldset>
    <p className="foot">Cotizaciones y bibliotecas se guardan en la base compartida del equipo. Las bibliotecas de precios y contratistas se comparten entre todas las cotizaciones.</p>
    <div className="stickytot no-print">
      <div className="st-main">
        <span className="st-lb">{cierre.activo ? "PRECIO DE CIERRE" : (totals.grpC > 0.005 ? "TOTAL A + B" : "TOTAL")}</span>
        <span className="st-val">Bs {fmt(cierre.cierreBs)}</span>
        {cierre.activo && cierre.descBs > 0.005 && <span className="st-sub">lista {fmt(cierre.listaBs)} · desc. {fmt(cierre.descBs)}</span>}
        {totals.grpC > 0.005 && <span className="st-sub">+ terceros {fmt(totals.grpC)} = {fmt(cierre.cierreBs + totals.grpC)}</span>}
      </div>
      {perms.ejecutivo && (<div className="st-marg"><span className="st-lb">UTILIDAD NETA</span><span className="st-val" style={{ color: (totals.utilNeta - cierre.descBs * 0.75) >= 0 ? "var(--good)" : "var(--bad)" }}>Bs {fmt(totals.utilNeta - cierre.descBs * (1 - (params.iuePct ?? 25) / 100))}</span></div>)}
      <span style={{ flex: 1 }} />
      {!ro && <button className="btn sm" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)"><ArrowLeft size={13} /> Deshacer</button>}
      <button className="btn sm" onClick={() => setModal("revision")}><ClipboardList size={13} /> Revisar</button>
      <button className="btn sm" onClick={() => setView("cliente")}><Eye size={13} /> Vista cliente</button>
      {!ro && <button className="btn sm primary" onClick={openSave}><Save size={13} /> Guardar</button>}
    </div>
    {modals}
  </div>);
}

/* ============================== SUBCOMPONENTES ============================== */
function TBCell({ label, val, on, ph }) { return (<div className="tb-cell"><label>{label}</label><input value={val} onChange={(e) => on(e.target.value)} placeholder={ph} /></div>); }
function PCell({ label, v, on, suf }) { return (<div className="pcell"><label>{label}</label><div className="pwrap"><input className="mono" inputMode="decimal" value={v} onChange={(e) => on(num(e.target.value))} /><span className="psuf">{suf}</span></div></div>); }
function SCell({ k, v, sub }) { return <div className="scell"><div className="k">{k}</div><div className="v">{v}</div>{sub ? <div className="scell-sub">{sub}</div> : null}</div>; }
const SEG_RANK = [
  { off: { bg: "#FBE7DA", fg: "#B05A22" }, on: { bg: "#E79B68", fg: "#3A2410" } }, // más alto — naranja
  { off: { bg: "#FAF0D2", fg: "#8A6D1B" }, on: { bg: "#E5CB74", fg: "#3A3210" } }, // medio — amarillo
  { off: { bg: "#DCEBDC", fg: "#3E7D4F" }, on: { bg: "#93C193", fg: "#153A15" } }, // más bajo — verde
];
function Seg({ label, options, value, onChange }) {
  return (<div className="rate-grp"><span className="rl">{label}</span>
    <div className="seg">{options.map((o, i) => {
      const r = SEG_RANK[i] || { off: { bg: "#F1F2F4", fg: "#8A93A3" }, on: { bg: "#8A93A3", fg: "#fff" } };
      const active = o === value; const col = active ? r.on : r.off;
      return <button key={i} onClick={() => onChange(o)} style={{ background: col.bg, color: col.fg, fontWeight: active ? 800 : 700, boxShadow: active ? "inset 0 0 0 1.5px rgba(0,0,0,.14)" : "none" }}>{o}%</button>;
    })}</div></div>);
}

function ItemRow({ no, it, params, first, last, suggestions, ctSuggestions, onFillCt, onSet, onSetC, onDel, onMove, onInsert, onSaveLib, onPickCt, onSaveCt, compact, onToggleCompact, onDragStartRow, onDropRow, dragActive }) {
  const dragProps = { onDragOver: (e) => { if (onDropRow) e.preventDefault(); }, onDrop: (e) => { if (onDropRow) { e.preventDefault(); onDropRow(); } } };
  const handle = dragActive ? <span className="drag-h no-print" draggable onDragStart={onDragStartRow} title="Arrastra para reordenar el ítem">⠿</span> : null;
  const [open, setOpen] = useState(false); const [openC, setOpenC] = useState(false); const [sugOpen, setSugOpen] = useState(false);
  const c = computeItem(it, params); const ct = it.contratista || {};
  const hasCt = (ct.nombre || ct.razonSocial || ct.nit || "").trim();
  const q = norm(it.descripcion || "");
  const matches = (sugOpen && q.length >= 2 && suggestions) ? suggestions.filter((s) => norm(s.descripcion).includes(q) && norm(s.descripcion) !== q).slice(0, 7) : [];
  const pick = (s) => { onSet("descripcion", s.descripcion); if (s.unidad) onSet("unidad", s.unidad); if (has(s.puDirecto)) onSet("puDirecto", String(s.puDirecto)); setSugOpen(false); };
  if (compact) return (<div className="item item-compact" onDoubleClick={onToggleCompact} {...dragProps}>
    {handle}
    <button className="ic-chev no-print" onClick={onToggleCompact} title="Desplegar ítem"><ChevronRight size={14} /></button>
    <span className="ic-no mono">{no}</span>
    <span className="ic-desc">{it.descripcion || <span style={{ color: "var(--muted)" }}>Sin descripción</span>}{hasCt ? <span className="ic-ct">· {ct.nombre || ct.razonSocial}</span> : null}</span>
    <span className="ic-q mono">{fmt(c.cant)} {it.unidad}</span>
    <span className="ic-pu mono">{it.puMoneda === "US$" ? "US$ " : ""}{fmt(it.precioFinal ? num(it.puFinal) : num(it.puDirecto))}</span>
    <span className="ic-tot mono">Bs {fmt(c.total)}</span>
  </div>);
  return (<div className="item" {...dragProps}>
    <div className="item-ops no-print">
      {handle}
      <button className="iconbtn mv" onClick={onToggleCompact} title="Comprimir ítem"><ChevronDown size={16} /></button>
      <span className="item-no">{no}</span><span style={{ flex: 1 }} />
      <button className="iconbtn mv" disabled={first} onClick={() => onMove(-1)} title="Subir"><ChevronUp size={16} /></button>
      <button className="iconbtn mv" disabled={last} onClick={() => onMove(1)} title="Bajar"><ChevronDown size={16} /></button>
      <button className="iconbtn mv" onClick={onInsert} title="Insertar ítem debajo"><Plus size={16} /></button>
      <button className="iconbtn" onClick={onDel} title="Eliminar"><Trash2 size={15} /></button>
    </div>
    <div className="ac-wrap">
      <textarea className="fld" rows={1} value={it.descripcion} placeholder="Descripción del ítem" onChange={(e) => { onSet("descripcion", e.target.value); setSugOpen(true); }} onFocus={() => setSugOpen(true)} onBlur={() => setTimeout(() => setSugOpen(false), 140)} onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }} />
      {matches.length > 0 && (<div className="ac-list">
        <div className="ac-head no-print"><BookOpen size={11} /> Sugerencias de tu biblioteca</div>
        {matches.map((s, i) => (<button key={i} className="ac-item" onMouseDown={(e) => { e.preventDefault(); pick(s); }}>
          <span className="ac-d">{s.descripcion}</span>
          <span className="ac-m">{s.unidad}{has(s.puDirecto) ? ` · Bs ${fmt(num(s.puDirecto))}` : ""} · {s.cat}</span>
        </button>))}
      </div>)}
    </div>
    <div className="grid3">
      <div><label className="lbl">Unidad</label><input className="fld" list="units-dl" value={it.unidad} onChange={(e) => onSet("unidad", e.target.value)} /></div>
      <div><label className="lbl">Cantidad</label><input className="fld num" inputMode="decimal" value={it.cantidad} placeholder="0.00" onChange={(e) => onSet("cantidad", e.target.value)} /></div>
      {it.precioFinal
        ? <div><label className="lbl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--accent-ink)" }}>P.U. final al cliente <select className="psel" style={{ fontSize: 10, padding: "1px 4px" }} value={it.puMoneda || "Bs"} onChange={(e) => onSet("puMoneda", e.target.value)}><option value="Bs">Bs</option><option value="US$">US$</option></select></label><input className="fld num" inputMode="decimal" value={it.puFinal || ""} placeholder="0.00" onChange={(e) => onSet("puFinal", e.target.value)} /></div>
        : <div><label className="lbl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>P.U. Directo <select className="psel" style={{ fontSize: 10, padding: "1px 4px" }} value={it.puMoneda || "Bs"} onChange={(e) => onSet("puMoneda", e.target.value)}><option value="Bs">Bs</option><option value="US$">US$</option></select></label><input className="fld num" inputMode="decimal" value={it.puDirecto} placeholder="0.00" onChange={(e) => onSet("puDirecto", e.target.value)} /></div>}
    </div>
    {it.puMoneda === "US$" && <div className="usd-row no-print"><DollarSign size={13} /> <span>Cotizado en US$ · TC proveedor</span><input className="fld num" style={{ width: 76 }} inputMode="decimal" value={it.puTC} placeholder="8.00" onChange={(e) => onSet("puTC", e.target.value)} /><span className="mono" style={{ color: "var(--accent-ink)" }}>= Bs {fmt(num(it.precioFinal ? it.puFinal : it.puDirecto) * (num(it.puTC) || 0))} /u</span></div>}
    <div className="pf-toggle no-print">
      <button className={"pf-btn" + (it.precioFinal ? " on" : "")} onClick={() => onSet("precioFinal", !it.precioFinal)}><TrendingUp size={12} /> {it.precioFinal ? "Precio final (inverso) ✓" : "Fijar precio final al cliente (inverso)"}</button>
      <button className={"pf-btn" + (it.sinCredito ? " on2" : "")} onClick={() => onSet("sinCredito", !it.sinCredito)}>{it.sinCredito ? "Sin crédito fiscal ✓" : "Sin crédito fiscal (sin factura)"}</button>
      {it.precioFinal && <span className="pf-hint">Costo directo deducido: Bs {fmt(c.e)} /u · CD total Bs {fmt(c.cd)}</span>}
    </div>
    {it.precioFinal
      ? <div className="rates"><label className="freerate">GG %<input className="fld num" inputMode="decimal" value={it.ggPct ?? params.ggDefault} onChange={(e) => onSet("ggPct", num(e.target.value))} /></label><label className="freerate">Utilidad %<input className="fld num" inputMode="decimal" value={it.utilPct ?? params.utilDefault} onChange={(e) => onSet("utilPct", num(e.target.value))} /></label></div>
      : <div className="rates"><Seg label="GG" options={params.ggOptions} value={c.ggPct} onChange={(v) => onSet("ggPct", v)} /><Seg label="Util." options={params.utilOptions} value={c.utilPct} onChange={(v) => onSet("utilPct", v)} /></div>}
    <div className="item-out"><div className="out-pu">P.U. Venta <b className="mono" style={{ color: "var(--ink)" }}>Bs {fmt(c.puVenta)}</b></div><div className="out-total">Bs {fmt(c.total)}</div></div>
    <div className="linkrow no-print">
      <button className="linkbtn" onClick={() => setOpen((o) => !o)}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {open ? "Ocultar" : "Ver"} desglose</button>
      <button className={"linkbtn" + (hasCt ? " has" : "")} onClick={() => setOpenC((o) => !o)}><HardHat size={13} /> {hasCt ? "Contratista: " + (ct.nombre || ct.razonSocial) : "Agregar contratista"}</button>
      <button className="linkbtn" onClick={onSaveLib}><PackagePlus size={13} /> Guardar en biblioteca</button>
    </div>
    {open && (<div className="breakdown">
      <div className="bd-row"><span>Costo directo</span><span>Bs {fmt(c.cd)}</span></div>
      <div className="bd-row"><span>Gastos generales ({c.ggPct}%)</span><span>Bs {fmt(c.ggBs)}</span></div>
      <div className="bd-row"><span>Utilidad bruta ({c.utilPct}%)</span><span>Bs {fmt(c.utilidad)}</span></div>
      {c.ivaCredLost > 0.005 && <div className="bd-row"><span style={{ color: "var(--muted)" }}>· IVA sin crédito (sin factura)</span><span style={{ color: "var(--muted)" }}>Bs {fmt(c.ivaCredLost)}</span></div>}
      <div className="bd-row"><span>IVA neto</span><span>Bs {fmt(c.ivaNeto)}</span></div>
      <div className="bd-row"><span>IT</span><span>Bs {fmt(c.itBs)}</span></div>
      {c.incidBs > 0.005 && <div className="bd-row"><span>Incidencias prorrateadas</span><span style={{ color: "var(--accent-ink)" }}>Bs {fmt(c.incidBs)}</span></div>}
      {it.precioFinal && <div className="bd-row" style={{ fontWeight: 700 }}><span>Precio final al cliente (fijado)</span><span>Bs {fmt(c.total)}</span></div>}
      <div className="bd-row"><span>Utilidad neta (post-IUE)</span><span style={{ color: "var(--good)" }}>Bs {fmt(c.utilNeta)}</span></div>
    </div>)}
    {openC && (<div className="contractor">
      <div className="contractor-h"><HardHat size={13} /> Datos del contratista <span className="priv">PRIVADO</span><span style={{ flex: 1 }} />
        <button className="btn sm no-print" onClick={onPickCt}><Users size={12} /> Elegir de libreta</button>
        {hasCt && <button className="btn sm no-print" onClick={onSaveCt}><PackagePlus size={12} /> Guardar en libreta</button>}
      </div>
      <div className="cgrid">
        <CtNameField v={ct.nombre} on={(v) => onSetC("nombre", v)} suggestions={ctSuggestions} onPick={onFillCt} />
        <CField label="Razón social" v={ct.razonSocial} on={(v) => onSetC("razonSocial", v)} ph="Empresa" />
        <CField label="NIT" v={ct.nit} on={(v) => onSetC("nit", v)} ph="Número de NIT" />
        <CField label="Contacto / teléfono" v={ct.contacto} on={(v) => onSetC("contacto", v)} ph="Celular" />
        <CField label="Correo" v={ct.correo} on={(v) => onSetC("correo", v)} ph="correo@ejemplo.com" />
      </div>
    </div>)}
  </div>);
}
function CField({ label, v, on, ph }) { return (<div><label className="lbl">{label}</label><input className="fld" value={v || ""} placeholder={ph} onChange={(e) => on(e.target.value)} /></div>); }
function CtNameField({ v, on, suggestions, onPick }) {
  const [op, setOp] = useState(false);
  const q = norm(v || "");
  const matches = (op && q.length >= 1 && suggestions) ? suggestions.filter((s) => { const nm = norm(s.nombre || s.razonSocial); return nm.includes(q) && nm !== q; }).slice(0, 6) : [];
  const pick = (s) => { onPick({ nombre: s.nombre || "", razonSocial: s.razonSocial || "", nit: s.nit || "", contacto: s.contacto || "", correo: s.correo || "" }); setOp(false); };
  return (<div style={{ position: "relative" }}>
    <label className="lbl">Nombre</label>
    <input className="fld" value={v || ""} placeholder="Nombre y apellido" onChange={(e) => { on(e.target.value); setOp(true); }} onFocus={() => setOp(true)} onBlur={() => setTimeout(() => setOp(false), 140)} />
    {matches.length > 0 && (<div className="ac-list">
      <div className="ac-head"><Users size={11} /> Contratistas de tu libreta</div>
      {matches.map((s, i) => (<button key={i} className="ac-item" onMouseDown={(e) => { e.preventDefault(); pick(s); }}>
        <span className="ac-d">{s.nombre || s.razonSocial}</span>
        <span className="ac-m">{[s.razonSocial && s.razonSocial !== s.nombre ? s.razonSocial : "", s.nit ? "NIT " + s.nit : "", s.contacto || ""].filter(Boolean).join(" · ")}</span>
      </button>))}
    </div>)}
  </div>);
}
function Scrim({ children, onClose }) { return (<div className="scrim" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>{children}</div></div>); }

/* ---------- Cost library modal ---------- */
function CostLibModal({ lib, onClose, onAddCat, onDelCat, onAddItem, onSetItem, onDelItem, onImport, target, onInsert, pending, onSaveTo }) {
  const [newCat, setNewCat] = useState(""); const [open, setOpen] = useState({});
  return (<Scrim onClose={onClose}>
    <div className="modal-h"><h3><BookOpen size={17} /> Biblioteca de precios</h3><button className="iconbtn" onClick={onClose}><X size={18} /></button></div>
    {pending && <div className="banner">Guardar «{pending.descripcion || "ítem"}» — elige la partida:</div>}
    {target && <div className="banner">Toca «Insertar» para agregar el ítem a tu cotización.</div>}
    <div className="addrow"><input className="fld" value={newCat} placeholder="Nueva partida (ej. CARPINTERÍA)" onChange={(e) => setNewCat(e.target.value)} /><button className="btn sm primary" onClick={() => { if (newCat.trim()) { onAddCat(newCat.trim().toUpperCase()); setNewCat(""); } }}><Plus size={13} /> Partida</button></div>
    {onImport && <div className="addrow"><span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>Cargar catálogo base ORIGINA ({CATALOGO_COUNT} ítems, sin duplicar)</span><button className="btn sm" onClick={onImport}><Download size={13} /> Importar catálogo</button></div>}
    {lib.length === 0 && <div className="empty">Sin partidas aún. Crea una arriba.</div>}
    {lib.map((cat) => (<div key={cat.id}>
      <div className="cathead" onClick={() => setOpen((o) => ({ ...o, [cat.id]: !o[cat.id] }))}>
        {open[cat.id] ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />}
        <span className="catname">{cat.nombre}</span><span className="catcount">{cat.items.length}</span>
        {pending && <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); onSaveTo(cat.id); }}>Guardar aquí</button>}
        <button className="iconbtn" onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar la partida y sus ítems?")) onDelCat(cat.id); }}><Trash2 size={14} /></button>
      </div>
      {open[cat.id] && (<>
        {cat.items.map((it) => (<div className="libitem" key={it.id}>
          <input className="d" value={it.descripcion} placeholder="Descripción" onChange={(e) => onSetItem(cat.id, it.id, "descripcion", e.target.value)} />
          <input className="u" value={it.unidad} placeholder="und" onChange={(e) => onSetItem(cat.id, it.id, "unidad", e.target.value)} />
          <input className="p" inputMode="decimal" value={it.puDirecto} placeholder="P.U." onChange={(e) => onSetItem(cat.id, it.id, "puDirecto", e.target.value)} />
          {target && <button className="btn sm primary" onClick={() => onInsert(it)}>Insertar</button>}
          <button className="iconbtn" onClick={() => onDelItem(cat.id, it.id)}><Trash2 size={14} /></button>
        </div>))}
        <div className="addrow" style={{ borderBottom: "1px solid #EEF0F3" }}><button className="linkbtn" onClick={() => onAddItem(cat.id)}><Plus size={13} /> Agregar ítem a {cat.nombre}</button></div>
      </>)}
    </div>))}
    <div style={{ padding: 14 }}><button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={onClose}>Cerrar</button></div>
  </Scrim>);
}

/* ---------- Contractor book modal ---------- */
function BookModal({ lib, onClose, onAdd, onSet, onDel, target, onUse, pending, onSavePending }) {
  const emptyF = { nombre: "", razonSocial: "", nit: "", contacto: "", correo: "" };
  const [f, setF] = useState(emptyF); const [show, setShow] = useState(false); const [editing, setEditing] = useState(null);
  return (<Scrim onClose={onClose}>
    <div className="modal-h"><h3><Users size={17} /> Libreta de contratistas</h3><button className="iconbtn" onClick={onClose}><X size={18} /></button></div>
    {target && <div className="banner">Toca «Usar» para asignar el contratista al ítem.</div>}
    {pending && ((pending.nombre || pending.razonSocial || pending.nit) ? <div className="addrow"><span style={{ fontSize: 12.5, flex: 1 }}>Guardar «{pending.nombre || pending.razonSocial}» en la libreta</span><button className="btn sm primary" onClick={onSavePending}><PackagePlus size={13} /> Guardar</button></div> : <div className="banner">Este ítem no tiene datos de contratista para guardar.</div>)}
    {!show ? <div className="addrow"><button className="linkbtn" onClick={() => setShow(true)}><Plus size={14} /> Agregar contratista nuevo</button></div>
      : (<div style={{ padding: 14, borderBottom: "1px solid #EEF0F3" }}>
        <div className="cgrid">
          <CField label="Nombre" v={f.nombre} on={(v) => setF({ ...f, nombre: v })} ph="Nombre" />
          <CField label="Razón social" v={f.razonSocial} on={(v) => setF({ ...f, razonSocial: v })} ph="Empresa" />
          <CField label="NIT" v={f.nit} on={(v) => setF({ ...f, nit: v })} ph="NIT" />
          <CField label="Contacto" v={f.contacto} on={(v) => setF({ ...f, contacto: v })} ph="Teléfono" />
          <CField label="Correo" v={f.correo} on={(v) => setF({ ...f, correo: v })} ph="correo@..." />
        </div>
        <div style={{ display: "flex", gap: 7, marginTop: 10 }}><button className="btn sm primary" onClick={() => { if ((f.nombre || f.razonSocial).trim()) { onAdd(f); setF(emptyF); setShow(false); } }}>Guardar</button><button className="btn sm" onClick={() => { setF(emptyF); setShow(false); }}>Cancelar</button></div>
      </div>)}
    {lib.length === 0 && <div className="empty">Aún no tienes contratistas guardados.</div>}
    {lib.map((c) => (<div className="ctrow" key={c.id}>
      {editing === c.id ? (
        <div className="cgrid" style={{ marginBottom: 8 }}>
          <CField label="Nombre" v={c.nombre} on={(v) => onSet(c.id, "nombre", v)} ph="Nombre" />
          <CField label="Razón social" v={c.razonSocial} on={(v) => onSet(c.id, "razonSocial", v)} ph="Empresa" />
          <CField label="NIT" v={c.nit} on={(v) => onSet(c.id, "nit", v)} ph="NIT" />
          <CField label="Contacto" v={c.contacto} on={(v) => onSet(c.id, "contacto", v)} ph="Teléfono" />
          <CField label="Correo" v={c.correo} on={(v) => onSet(c.id, "correo", v)} ph="correo@..." />
        </div>
      ) : (<>
        <div className="nm">{c.nombre || c.razonSocial || "—"}</div>
        <div className="dt">{c.razonSocial && <>Razón social: {c.razonSocial}<br /></>}{c.nit && <>NIT: {c.nit}  ·  </>}{c.contacto && <>Tel: {c.contacto}  ·  </>}{c.correo}</div>
      </>)}
      <div className="acts">
        {target && editing !== c.id && <button className="btn sm primary" onClick={() => onUse(c)}>Usar</button>}
        <button className="btn sm" onClick={() => setEditing(editing === c.id ? null : c.id)}>{editing === c.id ? "Listo" : <><Pencil size={12} /> Editar</>}</button>
        <button className="btn sm" onClick={() => { if (confirm("¿Eliminar de la libreta?")) onDel(c.id); }}><Trash2 size={13} /> Eliminar</button>
      </div>
    </div>))}
    <div style={{ padding: 14 }}><button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={onClose}>Cerrar</button></div>
  </Scrim>);
}

/* ---------- Contractor card ---------- */
function ContractorCard({ c, overlay, sections, onSetReal, onOpenOC, onLoadTypical, onAddHito, onSetHito, onDelHito, onAddAdic, onSetAdic, onDelAdic }) {
  const [expanded, setExpanded] = useState(false);
  const acc = contractorAccount(c.total, overlay); const none = c.none;
  const margen = c.totalCot - c.total;
  return (<div className="crep">
    <div className="crep-h" style={{ cursor: "pointer", borderBottom: expanded ? undefined : "none", marginBottom: expanded ? undefined : 0, paddingBottom: expanded ? undefined : 4 }} onClick={() => setExpanded((e) => !e)}>
      <div><div className="crep-name">{expanded ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}<HardHat size={17} color={none ? "var(--warn)" : "var(--accent-ink)"} />{none ? "SIN ASIGNACIÓN" : (c.info.nombre || c.info.razonSocial || "—")}</div>
        {!expanded && <div className="crep-info" style={{ marginLeft: 23 }}>{c.items.length} ítem(s) · Contratado Bs {fmt(c.total)}{!none && ` · Saldo Bs ${fmt(acc.saldoTotal)}`}</div>}
      </div>
      <div className="crep-total"><div className="k">Contratado</div><div className="v">Bs {fmt(c.total)}</div></div>
    </div>

    {expanded && (<>
      {!none && (c.info.razonSocial || c.info.nit || c.info.contacto || c.info.correo) && (
        <div className="crep-info" style={{ marginTop: 0, marginBottom: 8 }}>{c.info.razonSocial && <><b>Razón social:</b> {c.info.razonSocial}<br /></>}{c.info.nit && <><b>NIT:</b> {c.info.nit}   </>}{c.info.contacto && <><b>Tel:</b> {c.info.contacto}   </>}{c.info.correo && <><b>Correo:</b> {c.info.correo}</>}</div>)}
      {none && <div className="crep-info" style={{ marginBottom: 8 }}>Ítems cobrados al cliente sin contratista asignado. Asigna uno en el editor para gestionar pagos.</div>}

      <div className="acctbar">
        <div><div className="k">Cotizado</div><div className="v" style={{ color: "var(--muted)" }}>Bs {fmt(c.totalCot)}</div></div>
        <div><div className="k">Contratado</div><div className="v">Bs {fmt(c.total)}</div></div>
        <div><div className="k">Margen / resguardo</div><div className="v" style={{ color: margen >= -0.005 ? "var(--good)" : "var(--bad)" }}>Bs {fmt(margen)}</div></div>
        {!none && <div><div className="k">Saldo</div><div className="v" style={{ color: acc.saldoTotal > 0.005 ? "var(--warn)" : "var(--good)" }}>Bs {fmt(acc.saldoTotal)}</div></div>}
      </div>

      <div className="blocklabel"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Layers size={14} color="var(--accent-ink)" /> Ítems · costo real contratado</span></div>
      {c.items.map((x) => <RealItemCard key={x.iid} x={x} onSetReal={onSetReal} />)}

      {!none && (<>
        <div className="no-print" style={{ marginTop: 6 }}><button className="btn sm primary" onClick={onOpenOC}><FileText size={13} /> Generar orden de compra</button></div>
        <div className="blocklabel"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Wallet size={14} color="var(--accent-ink)" /> Control de pagos <span style={{ color: "var(--muted)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>(sobre contratado)</span></span><span className="rt no-print">{(!overlay.hitos || overlay.hitos.length === 0) && <button className="btn sm" onClick={onLoadTypical}>Cargar hitos típicos</button>}<button className="btn sm" onClick={onAddHito}><Plus size={13} /> Hito</button></span></div>
        {(!overlay.hitos || overlay.hitos.length === 0) ? <div className="empty" style={{ padding: "14px" }}>Sin hitos. Usa “Cargar hitos típicos” (Anticipo, Avance 1, Avance 2, Saldo) o agrega uno.</div>
          : overlay.hitos.map((h) => <HitoCard key={h.id} h={h} valor={c.total} onSet={(f, v) => onSetHito(h.id, f, v)} onDel={() => onDelHito(h.id)} />)}
        {overlay.hitos && overlay.hitos.length > 0 && (<div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}><span style={{ color: acc.pctSum !== 100 ? "var(--warn)" : "var(--muted)", fontWeight: 600 }}>{acc.pctSum !== 100 ? `Los hitos suman ${fmt(acc.pctSum)}% (deberían sumar 100%)` : "Hitos: 100% ✓"}</span><span className="mono" style={{ fontWeight: 700 }}>Pagado Bs {fmt(acc.princPagado)} · Saldo Bs {fmt(acc.princSaldo)}</span></div>)}
        <div className="blocklabel"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Layers size={14} color="var(--accent-ink)" /> Adicionales</span><span className="rt no-print"><button className="btn sm" onClick={onAddAdic}><Plus size={13} /> Adicional</button></span></div>
        {(!overlay.adicionales || overlay.adicionales.length === 0) ? <div className="empty" style={{ padding: "12px" }}>Sin adicionales registrados.</div>
          : (<>{overlay.adicionales.map((a) => <AdicCard key={a.id} a={a} sections={sections} onSet={(f, v) => onSetAdic(a.id, f, v)} onDel={() => onDelAdic(a.id)} />)}<div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}><span style={{ color: "var(--muted)", fontWeight: 600 }}>Adicionales</span><span className="mono" style={{ fontWeight: 700 }}>Valor Bs {fmt(acc.adicValor)} · Pagado Bs {fmt(acc.adicPagado)} · Saldo Bs {fmt(acc.adicSaldo)}</span></div></>)}
      </>)}
    </>)}
  </div>);
}
function RealItemCard({ x, onSetReal }) {
  const qReal = has(x.cantReal) ? num(x.cantReal) : x.qCot;
  const pReal = has(x.puReal) ? num(x.puReal) : x.pCot;
  const contratado = qReal * pReal; const margen = x.cotizado - contratado;
  return (<div className="hito">
    <div className="hito-r1"><span className="item-no" style={{ marginRight: 4 }}>{x.no}</span><span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{x.descripcion || "—"}</span></div>
    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontFamily: "var(--mono)" }}>Cotizado: {fmt(x.qCot)} × {fmt(x.pCot)} = <b style={{ color: "var(--ink2)" }}>Bs {fmt(x.cotizado)}</b></div>
    <div className="hito-r3" style={{ borderTop: "1px dashed var(--line)", marginTop: 8 }}>
      <div><div className="lbl">Cant. real</div><input className="miniinput money" style={{ width: 78 }} inputMode="decimal" value={x.cantReal ?? ""} placeholder={fmt(x.qCot)} onChange={(e) => onSetReal(x.iid, "cantReal", e.target.value)} /></div>
      <div><div className="lbl">P.U. real Bs</div><input className="miniinput money" style={{ width: 92 }} inputMode="decimal" value={x.puReal ?? ""} placeholder={fmt(x.pCot)} onChange={(e) => onSetReal(x.iid, "puReal", e.target.value)} /></div>
      <div style={{ textAlign: "right", flex: 1 }}>
        <div style={{ fontSize: 11, fontFamily: "var(--mono)" }}>Contratado <b>Bs {fmt(contratado)}</b></div>
        <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: margen >= -0.005 ? "var(--good)" : "var(--bad)" }}>Margen Bs {fmt(margen)}</div>
      </div>
    </div>
  </div>);
}
function HitoCard({ h, valor, onSet, onDel }) {
  const prog = (num(h.pct) / 100) * valor;
  return (<div className="hito">
    <div className="hito-r1"><input className="hito-nm" value={h.nombre} placeholder="Nombre del hito" onChange={(e) => onSet("nombre", e.target.value)} /><input className="hito-pct" inputMode="decimal" value={h.pct} onChange={(e) => onSet("pct", num(e.target.value))} /><span className="psuf">%</span><button className="iconbtn no-print" onClick={onDel}><Trash2 size={14} /></button></div>
    <div className="hito-r2"><span className="prog">Programado <b>Bs {fmt(prog)}</b></span><button className={"toggle " + (h.pagado ? "paid" : "pending")} onClick={() => onSet("pagado", !h.pagado)}>{h.pagado ? "Pagado" : "Pendiente"}</button></div>
    {h.pagado && (<div className="hito-r3"><div><div className="lbl">Monto pagado</div><input className="miniinput money" inputMode="decimal" value={h.montoPagado} placeholder={fmt(prog)} onChange={(e) => onSet("montoPagado", e.target.value)} /></div><div><div className="lbl">Fecha</div><input className="miniinput" type="date" value={h.fecha || ""} onChange={(e) => onSet("fecha", e.target.value)} /></div></div>)}
  </div>);
}
function ResguardoView({ pa2, contractors, pay, onAddExtra }) {
  const [open, setOpen] = useState(null);
  const t = pa2.tot;
  const ctOptions = (pay && pay.list ? pay.list.filter((c) => !c.none) : []);
  return (<div>
    <div className="kpis" style={{ marginBottom: 12 }}>
      <div className="kpi"><div className="k">Cotizado (A+B)</div><div className="v">Bs {fmt(t.cotizado)}</div></div>
      <div className="kpi"><div className="k">Contratado</div><div className="v">Bs {fmt(t.contratado)}</div></div>
      <div className="kpi"><div className="k">Compras extra</div><div className="v" style={{ color: t.extras > 0.005 ? "var(--warn)" : "var(--ink)" }}>Bs {fmt(t.extras)}</div></div>
      <div className="kpi"><div className="k">Resguardo disponible</div><div className="v" style={{ color: t.resguardoNeto >= -0.005 ? "var(--good)" : "var(--bad)" }}>Bs {fmt(t.resguardoNeto)}</div></div>
    </div>
    {t.extrasSinPartida > 0.005 && <div className="ro-banner" style={{ background: "#FBF4E9", borderColor: "#E6D3AE", color: "var(--warn)" }}><Info size={14} /> Hay <b>Bs {fmt(t.extrasSinPartida)}</b> en adicionales <b>sin partida asignada</b>. Asígnales una partida para que descuenten de la bolsa correcta.</div>}
    <div className="crep" style={{ padding: "12px 12px 4px", marginBottom: 12 }}>
      <div className="ch-t">Cotizado vs. contratado por partida</div>
      <BarsPartidas rows={pa2.rows} rate={1} sym="Bs" />
    </div>
    <div className="crep" style={{ padding: 0 }}>
      <table className="ectable"><thead><tr><th>Partida</th><th className="r">Cotizado</th><th className="r">Contratado</th><th className="r">Extras</th><th className="r">Resguardo</th><th style={{ width: 40 }}></th></tr></thead>
        <tbody>
          {pa2.rows.map((r) => (<React.Fragment key={r.id}>
            <tr style={{ cursor: "pointer" }} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <td><b>{r.nombre}</b> <span style={{ color: "var(--muted)", fontSize: 10.5 }}>({r.grupo})</span></td>
              <td className="r mono">{fmt(r.cotizado)}</td>
              <td className="r mono">{fmt(r.contratado)}</td>
              <td className="r mono" style={{ color: r.extras > 0.005 ? "var(--warn)" : "var(--muted)" }}>{r.extras > 0.005 ? fmt(r.extras) : "—"}</td>
              <td className="r mono" style={{ fontWeight: 800, color: r.resguardo >= -0.005 ? "var(--good)" : "var(--bad)" }}>{fmt(r.resguardo)}</td>
              <td className="r">{r.extraList.length > 0 ? (open === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : ""}</td>
            </tr>
            {open === r.id && (<tr><td colSpan={6} style={{ background: "#FAFAF8", padding: "8px 12px" }}>
              {r.extraList.length > 0 ? r.extraList.map((x) => (<div key={x.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "3px 0", borderBottom: "1px solid var(--line)" }}><span>{x.descripcion || "Sin descripción"} <span style={{ color: "var(--muted)" }}>· {x.contratista}</span></span><span className="mono">Bs {fmt(x.monto)}</span></div>)) : <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Sin compras extra en esta partida.</div>}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 9, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Agregar compra no cotizada a esta partida:</span>
                <select className="psel" id={"ct-" + r.id} defaultValue=""><option value="">Sin contratista</option>{ctOptions.map((c) => <option key={c.key} value={c.key}>{(c.info && c.info.nombre) || c.key}</option>)}</select>
                <button className="btn sm" onClick={(e) => { e.stopPropagation(); const sel = document.getElementById("ct-" + r.id); onAddExtra(r.id, sel ? sel.value : ""); }}><Plus size={13} /> Agregar</button>
              </div>
            </td></tr>)}
          </React.Fragment>))}
        </tbody>
      </table>
    </div>
    <p className="foot">Resguardo = Cotizado − Contratado − Compras extra. Las compras no cotizadas consumen la bolsa de la partida a la que las asignes. Vista privada: no se muestra al cliente.</p>
  </div>);
}
function AdicCard({ a, onSet, onDel, sections }) {
  const total = montoAdic(a);
  return (<div className="hito">
    <div className="hito-r1"><input className="hito-nm" value={a.descripcion} placeholder="Descripción del adicional" onChange={(e) => onSet("descripcion", e.target.value)} /><button className="iconbtn no-print" onClick={onDel}><Trash2 size={14} /></button></div>
    <div className="hito-r3" style={{ borderTop: "none", paddingTop: 0, marginTop: 8, flexWrap: "wrap" }}>
      <div><div className="lbl">Cantidad</div><input className="miniinput money" style={{ width: 64 }} inputMode="decimal" value={a.cantidad ?? ""} placeholder="0" onChange={(e) => onSet("cantidad", e.target.value)} /></div>
      <div><div className="lbl">P.U. {a.moneda === "US$" ? "US$" : "Bs"}</div><input className="miniinput money" style={{ width: 82 }} inputMode="decimal" value={a.pu ?? ""} placeholder="0.00" onChange={(e) => onSet("pu", e.target.value)} /></div>
      <div><div className="lbl">Moneda</div><select className="psel" value={a.moneda || "Bs"} onChange={(e) => onSet("moneda", e.target.value)}><option value="Bs">Bs</option><option value="US$">US$</option></select></div>
      {a.moneda === "US$" && <div><div className="lbl">TC</div><input className="miniinput money" style={{ width: 60 }} inputMode="decimal" value={a.tc ?? ""} placeholder="8.00" onChange={(e) => onSet("tc", e.target.value)} /></div>}
      <div style={{ textAlign: "right", flex: 1 }}><div className="lbl">Total Bs</div><div className="mono" style={{ fontWeight: 700 }}>Bs {fmt(total)}</div></div>
    </div>
    {sections && (<div className="adic-part no-print"><span className="lbl" style={{ margin: 0 }}>Cargar a la partida</span>
      <select className="psel" style={{ flex: 1, minWidth: 150 }} value={a.partidaId || ""} onChange={(e) => onSet("partidaId", e.target.value)}>
        <option value="">— Sin partida (no consume resguardo) —</option>
        {sections.filter((s) => s.grupo !== "C").map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select></div>)}
    <div className="hito-r2" style={{ marginTop: 8 }}><span className="prog" style={{ color: "var(--muted)" }}>Estado de pago</span><button className={"toggle " + (a.pagado ? "paid" : "pending")} onClick={() => onSet("pagado", !a.pagado)}>{a.pagado ? "Pagado" : "Pendiente"}</button></div>
    {a.pagado && (<div className="hito-r3"><div><div className="lbl">Monto pagado</div><input className="miniinput money" inputMode="decimal" value={a.montoPagado} placeholder={fmt(total)} onChange={(e) => onSet("montoPagado", e.target.value)} /></div><div><div className="lbl">Fecha</div><input className="miniinput" type="date" value={a.fecha || ""} onChange={(e) => onSet("fecha", e.target.value)} /></div></div>)}
  </div>);
}

/* ---------- Estado de cuentas ---------- */
function EmpresaView({ data, filter, setFilter, onOpen, tcO }) {
  const B = (x) => "Bs " + fmt(x);
  if (data === null) return (<div className="crep"><div className="empty">Cargando obras…</div></div>);
  if (data.length === 0) return (<div><div className="titleblock" style={{ marginBottom: 12 }}><div className="tb-top"><Layers size={20} /><div style={{ flex: 1 }}><h1>PANEL EMPRESA</h1><div className="sub">Salud financiera consolidada</div></div></div></div><div className="crep"><div className="empty">Aún no hay obras guardadas. Guarda una cotización (botón Guardar) para verla en el panel.</div></div></div>);
  const estados = ["Cotizada", "Adjudicada", "En ejecución", "Cerrada"];
  const rows = filter ? data.filter((d) => d.estado === filter) : data;
  const sum = (k) => rows.reduce((a, d) => a + (d[k] || 0), 0);
  const ventas = sum("cotizado"), utilReal = sum("utilRealD"), caja = sum("caja"), porCobrar = sum("porCobrar"), porPagar = sum("porPagar");
  const backlog = rows.filter((d) => d.estado !== "Cerrada").reduce((a, d) => a + d.porCobrar, 0);
  const margenPond = ventas > 0 ? utilReal / ventas * 100 : 0;
  const cnt = (e) => data.filter((d) => d.estado === e).length;
  const badge = (e) => e === "Cerrada" ? "b-cer" : e === "En ejecución" ? "b-eje" : e === "Adjudicada" ? "b-adj" : "b-cot";
  return (<div>
    <div className="titleblock" style={{ marginBottom: 12 }}><div className="tb-top"><Layers size={20} /><div style={{ flex: 1 }}><h1>PANEL EMPRESA</h1><div className="sub">Salud financiera consolidada · {data.length} obra(s)</div></div><span className="priv no-print">PRIVADO</span></div></div>

    <div className="summary">
      <div className="sum-hero"><div><div className="eyebrow" style={{ color: "#B7B8B8" }}>Ventas totales {filter ? `· ${filter}` : "· todas"}</div><div className="big">Bs {fmt(ventas)}</div><div className="usd">US$ {fmt(ventas / tcO)} oficial · Utilidad real acumulada (post-IUE) Bs {fmt(utilReal)}</div></div></div>
      <div className="sum-grid">
        <SCell k="Margen real ponderado" v={fmt(margenPond) + "%"} />
        <SCell k="Caja consolidada" v={B(caja)} />
        <SCell k="Cartera / backlog" v={B(backlog)} />
        <SCell k="Por cobrar / por pagar" v={B(porCobrar)} sub={"Pagar: " + B(porPagar)} />
      </div>
    </div>

    <div className="empfilters no-print">
      <button className={"chip" + (filter === "" ? " on" : "")} onClick={() => setFilter("")}>Todas ({data.length})</button>
      {estados.map((e) => <button key={e} className={"chip" + (filter === e ? " on" : "")} onClick={() => setFilter(e)}>{e} ({cnt(e)})</button>)}
    </div>

    <div className="ec-block"><div className="ec-head"><span>Obras {filter ? `· ${filter}` : ""}</span><span className="amt">{rows.length}</span></div>
      <table className="ectable emptable"><thead><tr><th>Proyecto</th><th>Estado</th><th className="r">Ventas Bs</th><th className="r">Rent.</th><th className="r">Caja Bs</th><th className="r">x cobrar</th><th className="r">x pagar</th></tr></thead>
        <tbody>
          {rows.map((d) => (<tr key={d.id} className="emprow" onClick={() => onOpen(d.id)}>
            <td><div style={{ fontWeight: 700 }}>{d.nombre}</div><div style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.codigo}{d.cliente ? " · " + d.cliente : ""}</div></td>
            <td><span className={"badge " + badge(d.estado)}>{d.estado}</span></td>
            <td className="r">{fmt(d.cotizado)}</td>
            <td className="r" style={{ color: d.rentReal >= 0 ? "var(--good)" : "var(--bad)" }}>{fmt(d.rentReal)}%</td>
            <td className="r" style={{ color: d.caja >= -0.005 ? "var(--good)" : "var(--bad)" }}>{fmt(d.caja)}</td>
            <td className="r" style={{ color: d.porCobrar > 0.005 ? "var(--warn)" : "var(--ink)" }}>{fmt(d.porCobrar)}</td>
            <td className="r" style={{ color: d.porPagar > 0.005 ? "var(--warn)" : "var(--ink)" }}>{fmt(d.porPagar)}</td>
          </tr>))}
          <tr className="tot"><td colSpan={2}>Total ({rows.length})</td><td className="r">{fmt(ventas)}</td><td className="r">{fmt(margenPond)}%</td><td className="r">{fmt(caja)}</td><td className="r">{fmt(porCobrar)}</td><td className="r">{fmt(porPagar)}</td></tr>
        </tbody>
      </table>
    </div>
    <div className="efnote no-print" style={{ marginTop: 4 }}>Toca una obra para abrirla. Las cifras "reales" dependen de que registres en cada obra lo contratado y los cobros del cliente.</div>
  </div>);
}
function computeAvance(sections, p, avances) {
  let totW = 0, totA = 0; const grp = { A: { w: 0, a: 0 }, B: { w: 0, a: 0 } };
  const rows = sections.filter((s) => s.grupo !== "C").map((s) => {
    const w = s.items.reduce((acc, it) => acc + computeItem(it, p).total, 0);
    const pct = Math.max(0, Math.min(100, num((avances || {})[s.id])));
    const g = s.grupo === "B" ? "B" : "A"; grp[g].w += w; grp[g].a += w * pct; totW += w; totA += w * pct;
    return { id: s.id, nombre: s.nombre, grupo: g, pct, estado: pct >= 99.5 ? "Terminada" : pct <= 0.5 ? "No iniciada" : "En curso", peso: w };
  });
  return { global: totW > 0 ? totA / totW : 0, grpA: grp.A.w > 0 ? grp.A.a / grp.A.w : 0, grpB: grp.B.w > 0 ? grp.B.a / grp.B.w : 0, hasA: grp.A.w > 0, hasB: grp.B.w > 0, rows };
}
function SummaryView({ meta, params, totals, pa, ib, disc, cobros, hitosPago, contrato, onAddCobro, onSetCobro, onDelCobro, onLoadTypicalCobros }) {
  const iva = (params.ivaPct ?? 13) / 100, iue = (params.iuePct ?? 25) / 100;
  const tcO = params.tcOficial || 1, tcR = params.tcReal || 1;
  const cotizado = totals.total;
  const utilProyA = totals.utilidad, utilProyD = utilProyA * (1 - iue);
  const margen = pa.margen;
  const utilRealA = utilProyA + margen, utilRealD = utilRealA * (1 - iue);
  const ivaDeb = iva * cotizado, ivaNeto = totals.ivaNeto, ivaCred = ivaDeb - ivaNeto;
  const itBs = totals.itBs, iueReal = utilRealA * iue;
  const impIndir = ivaNeto + itBs, totalImp = impIndir + iueReal;
  const subcontratado = pa.totalC, porPagar = pa.totalS;
  const rentReal = cotizado > 0 ? utilRealD / cotizado * 100 : 0, rentProy = cotizado > 0 ? utilProyD / cotizado * 100 : 0;
  const sup = num(meta.superficie), costoM2 = sup > 0 ? cotizado / sup : 0;
  // eficiencia de contratación
  const costoProy = pa.cotBase, costoReal = pa.contrBase;
  const efPct = costoProy > 0 ? (costoProy - costoReal) / costoProy * 100 : 0;
  // flujo de caja
  const hp = hitosPago || [];
  const contratoBs = contrato > 0 ? contrato : cotizado;
  const cobrado = hp.length
    ? hp.reduce((a, h) => a + (h.cobrado ? (has(h.montoReal) ? num(h.montoReal) : contratoBs * num(h.pct) / 100) : 0), 0)
    : (cobros || []).reduce((a, x) => a + num(x.monto), 0);
  const pagado = pa.totalP;
  const caja = cobrado - pagado;
  const porCobrar = contratoBs - cobrado;
  const pctCobrado = contratoBs > 0 ? cobrado / contratoBs * 100 : 0;
  const pctPagado = subcontratado > 0 ? pagado / subcontratado * 100 : 0;
  const B = (x) => "Bs " + fmt(x);
  return (<div>
    <div className="titleblock" style={{ marginBottom: 12 }}><div className="tb-top"><TrendingUp size={20} /><div style={{ flex: 1 }}><h1>RESUMEN EJECUTIVO</h1><div className="sub">{meta.proyecto || "Proyecto"} · {meta.codigo} · {meta.estado || "Cotizada"}</div></div><span className="priv no-print">PRIVADO</span></div></div>

    <div className="summary">
      <div className="sum-hero"><div><div className="eyebrow" style={{ color: "#B7B8B8" }}>Monto total cotizado</div><div className="big">Bs {fmt(cotizado)}</div><div className="usd">US$ {fmt(cotizado / tcO)} oficial · US$ {fmt(cotizado / tcR)} real{sup > 0 ? ` · ${fmt(sup)} m²` : ""}</div></div></div>
      <div className="sum-grid">
        <SCell k="Rentabilidad real (post-IUE)" v={fmt(rentReal) + "%"} />
        <SCell k="Costo por m²" v={sup > 0 ? B(costoM2) : "—"} sub={sup > 0 ? "US$ " + fmt(costoM2 / tcO) + " oficial" : ""} />
        <SCell k="Total subcontratado" v={B(subcontratado)} />
        <SCell k="Cuentas por pagar" v={B(porPagar)} />
      </div>
    </div>

    <div className="kgrid">
      <div className="kcard">
        <div className="kc-h"><span className="kc-t">Utilidad proyectada</span><span className="kc-tag">cotizado</span></div>
        <div className="kc-rows"><div><span>Antes de IUE</span><b>{B(utilProyA)}</b></div><div><span>Después de IUE</span><b style={{ color: "var(--good)" }}>{B(utilProyD)}</b></div><div className="kc-sub"><span>Margen neto s/ venta</span><b>{fmt(rentProy)}%</b></div></div>
      </div>
      <div className="kcard accent">
        <div className="kc-h"><span className="kc-t">Utilidad real</span><span className="kc-tag a">contratado</span></div>
        <div className="kc-rows"><div><span>Antes de IUE</span><b>{B(utilRealA)}</b></div><div><span>Después de IUE</span><b style={{ color: "var(--good)" }}>{B(utilRealD)}</b></div><div className="kc-sub"><span>Margen/resguardo capturado</span><b style={{ color: margen >= -0.005 ? "var(--good)" : "var(--bad)" }}>{B(margen)}</b></div></div>
      </div>
    </div>

    <div className="ec-block"><div className="ec-head"><span>Eficiencia de contratación</span><span className="amt" style={{ color: efPct >= -0.005 ? "var(--good)" : "var(--bad)" }}>{fmt(efPct)}%</span></div>
      <table className="ectable"><tbody>
        <tr><td>Costo proyectado (lo que planeé gastar)</td><td className="r">{B(costoProy)}</td></tr>
        <tr><td>Costo contratado (lo que realmente gasto)</td><td className="r">{B(costoReal)}</td></tr>
        <tr className="tot"><td>Ahorro / eficiencia</td><td className="r" style={{ color: efPct >= -0.005 ? "var(--good)" : "var(--bad)" }}>{B(costoProy - costoReal)} · {fmt(efPct)}%</td></tr>
      </tbody></table>
      <div className="efbar"><div className="efbar-fill" style={{ width: Math.max(0, Math.min(100, 100 - efPct)) + "%" }} /></div>
      <div className="efnote">Proyecté gastar {B(costoProy)} y contraté en {B(costoReal)}: fui eficiente en <b>{fmt(efPct)}%</b> ({B(costoProy - costoReal)}), que se suma a tu utilidad.</div>
    </div>

    <div className="ec-block"><div className="ec-head"><span>Flujo de caja de la obra</span><span className="amt" style={{ color: caja >= -0.005 ? "var(--good)" : "var(--bad)" }}>{B(caja)}</span></div>
      <div className="cf-hd no-print"><span>Cobros del cliente · hitos de pago</span><span className="rt" style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 400 }}>Se editan en “Forma de pago”, en el bloque superior</span></div>
      {(hitosPago || []).length === 0 ? <div className="empty" style={{ padding: "12px" }}>Aún no definiste la forma de pago. Cárgala en el bloque superior para proyectar tu caja.</div>
        : (<table className="ectable"><thead><tr><th>Hito</th><th>Fecha</th><th className="r">%</th><th className="r">Monto</th><th>Estado</th></tr></thead>
          <tbody>{hitosPago.map((h, i) => (<tr key={h.id}><td>{i + 1}. {h.detalle || "—"}</td><td>{h.cobrado ? (h.fechaReal || "—") : (h.fechaEst || "—")}</td><td className="r mono">{fmt(num(h.pct))}%</td><td className="r mono">{fmt((h.cobrado && has(h.montoReal) ? num(h.montoReal) : contrato * num(h.pct) / 100))}</td>
            <td><span className={"estchip est-" + (h.cobrado ? "ok" : "no")}>{h.cobrado ? "Cobrado" : "Por cobrar"}</span></td></tr>))}</tbody></table>)}
      <table className="ectable" style={{ marginTop: 8 }}><tbody>
        <tr><td>Cobrado del cliente ({fmt(pctCobrado)}% del contrato)</td><td className="r" style={{ color: "var(--good)" }}>{B(cobrado)}</td></tr>
        <tr><td>Pagado a contratistas ({fmt(pctPagado)}% de lo contratado)</td><td className="r">− {B(pagado)}</td></tr>
        <tr className="tot"><td>Posición de caja de la obra</td><td className="r" style={{ color: caja >= -0.005 ? "var(--good)" : "var(--bad)" }}>{B(caja)}</td></tr>
        <tr><td>Por cobrar al cliente</td><td className="r" style={{ color: porCobrar > 0.005 ? "var(--warn)" : "var(--ink)" }}>{B(porCobrar)}</td></tr>
        <tr><td>Por pagar a contratistas</td><td className="r" style={{ color: porPagar > 0.005 ? "var(--warn)" : "var(--ink)" }}>{B(porPagar)}</td></tr>
      </tbody></table>
      {caja < -0.005 && <div className="efnote" style={{ color: "var(--bad)" }}>Caja negativa: estás financiando la obra (pagas más de lo que has cobrado). Vigila el anticipo del cliente.</div>}
    </div>

    <div className="ec-block"><div className="ec-head"><span>Impuestos a pagar</span><span className="amt">{B(totalImp)}</span></div>
      <table className="ectable"><tbody>
        <tr><td>IVA débito fiscal (13% s/ ventas)</td><td className="r">{B(ivaDeb)}</td></tr>
        <tr><td>IVA crédito fiscal (por compras con factura)</td><td className="r" style={{ color: "var(--good)" }}>− {B(ivaCred)}</td></tr>
        <tr className="tot"><td>IVA neto a pagar</td><td className="r">{B(ivaNeto)}</td></tr>
        <tr><td>IT (Impuesto a las Transacciones)</td><td className="r">{B(itBs)}</td></tr>
        <tr><td>IUE (25% s/ utilidad real)</td><td className="r">{B(iueReal)}</td></tr>
        <tr className="tot"><td>Total impuestos</td><td className="r">{B(totalImp)}</td></tr>
      </tbody></table>
    </div>

    <div className="ec-block"><div className="ec-head"><span>Subcontratación (cuentas por pagar)</span><span className="amt">{B(subcontratado)}</span></div>
      <table className="ectable"><tbody>
        <tr><td>Total contratado (real, incl. adicionales)</td><td className="r">{B(subcontratado)}</td></tr>
        <tr><td>Pagado a la fecha</td><td className="r" style={{ color: "var(--good)" }}>{B(pa.totalP)}</td></tr>
        <tr className="tot"><td>Saldo por pagar</td><td className="r" style={{ color: porPagar > 0.005 ? "var(--warn)" : "var(--ink)" }}>{B(porPagar)}</td></tr>
      </tbody></table>
    </div>

    {totals.grpC > 0.005 && (<div className="ec-block"><div className="ec-head"><span>Terceros · Grupo C (informativo)</span><span className="amt" style={{ color: "#8A6D3B" }}>{B(totals.grpC)}</span></div>
      <table className="ectable"><tbody>
        <tr><td>Contratación directa del cliente (proveedores externos)</td><td className="r">{B(totals.grpC)}</td></tr>
        <tr className="tot"><td>Inversión total que ve el cliente (tu oferta + terceros)</td><td className="r">{B(totals.total + totals.grpC)}</td></tr>
      </tbody></table>
      <div className="efnote">El Grupo C <b>no forma parte de tus ingresos, utilidad ni impuestos</b>: es el monto que el cliente contrata directo con el proveedor. Se muestra solo para su visibilidad integral.</div>
    </div>)}

    {disc && disc.hasDisc && (<div className="ec-block"><div className="ec-head"><span>Descuentos visibles al cliente (netos)</span><span className="amt" style={{ color: "var(--good)" }}>Neto 0</span></div>
      <table className="ectable"><tbody>
        <tr><td>Subtotal que ve el cliente (inflado)</td><td className="r">{B(disc.S_shown)}</td></tr>
        {disc.items.map((x) => (<tr key={x.id}><td>{x.nombre || "Descuento"} {x.tipo === "pct" ? <span style={{ color: "var(--muted)" }}>({fmt(num(x.valor))}% del subtotal)</span> : ""}</td><td className="r" style={{ color: "var(--accent-ink)" }}>− {B(x.montoBs)}</td></tr>))}
        <tr className="tot"><td>Precio final al cliente = tu proyección</td><td className="r">{B(totals.total)}</td></tr>
      </tbody></table>
      <div className="efnote">El cliente percibe un descuento de <b>{B(disc.totalDescBs)}</b>, pero está pre-incrustado en el precio: <b>no afecta tu utilidad proyectada</b>. Sin GG ni utilidad sobre el descuento.</div>
    </div>)}

    {ib.totalCosto > 0.005 && (<div className="ec-block"><div className="ec-head"><span>Incidencias camufladas</span><span className="amt">{B(ib.totalCosto)}</span></div>
      <table className="ectable"><tbody>
        {ib.items.map((x) => (<tr key={x.id}><td>{x.nombre || "—"} <span style={{ color: "var(--muted)" }}>({x.tipo === "pct" ? `${fmt(num(x.valor))}% del total` : "fijo"} · GG {x.ggP}% · Ut {x.utilP}%)</span></td><td className="r">{B(x.montoBs)}</td></tr>))}
        <tr className="tot"><td>Costo total de incidencias</td><td className="r">{B(ib.totalCosto)}</td></tr>
      </tbody></table>
    </div>)}
  </div>);
}
function EstadoCuentas({ pa }) {
  if (pa.rows.length === 0) return <div className="crep"><div className="empty">Carga ítems con costo para ver el estado de cuentas.</div></div>;
  return (<>
    <div className="ecgrand"><div><div className="k">Contratado (real)</div><div className="v">Bs {fmt(pa.totalC)}</div></div><div><div className="k">Pagado</div><div className="v" style={{ color: "var(--good)" }}>Bs {fmt(pa.totalP)}</div></div><div><div className="k">Saldo por pagar</div><div className="v" style={{ color: pa.totalS > 0.005 ? "var(--warn)" : "var(--ink)" }}>Bs {fmt(pa.totalS)}</div></div></div>

    <div className="note" style={{ background: pa.margen >= -0.005 ? "var(--good-soft)" : "#FBECEA", borderColor: pa.margen >= -0.005 ? "#BFE0CB" : "#E7B6AE", color: pa.margen >= -0.005 ? "var(--good)" : "var(--bad)" }}>
      <Layers size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span><b>Margen / resguardo capturado: Bs {fmt(pa.margen)}</b> &nbsp;(Cotizado Bs {fmt(pa.cotBase)} − Contratado real Bs {fmt(pa.contrBase)}). Esta diferencia refuerza tu utilidad o queda como colchón ante imprevistos.</span>
    </div>

    <div className="ec-block"><div className="ec-head"><span>Contrato principal · por hito de pago</span><span className="amt">Bs {fmt(pa.princC)}</span></div>
      <table className="ectable"><thead><tr><th>Hito</th><th className="r">Programado</th><th className="r">Pagado</th><th className="r">Pendiente</th></tr></thead><tbody>
        {pa.order.length === 0 && <tr><td colSpan={4} style={{ color: "var(--muted)" }}>Sin hitos de pago cargados aún.</td></tr>}
        {pa.order.map((nm) => { const m = pa.milestones[nm]; return (<tr key={nm}><td style={{ fontWeight: 600 }}>{nm}</td><td className="r">{fmt(m.prog)}</td><td className="r" style={{ color: "var(--good)" }}>{fmt(m.pag)}</td><td className="r" style={{ color: "var(--warn)" }}>{fmt(m.prog - m.pag)}</td></tr>); })}
        <tr className="tot"><td>Total principal</td><td className="r">{fmt(pa.princC)}</td><td className="r">{fmt(pa.princP)}</td><td className="r">{fmt(pa.princS)}</td></tr>
      </tbody></table></div>

    <div className="ec-block"><div className="ec-head"><span>Adicionales</span><span className="amt">Bs {fmt(pa.adicC)}</span></div>
      <table className="ectable"><thead><tr><th>Concepto</th><th className="r">Contratado</th><th className="r">Pagado</th><th className="r">Pendiente</th></tr></thead><tbody>
        <tr><td style={{ fontWeight: 600 }}>Total adicionales del proyecto</td><td className="r">{fmt(pa.adicC)}</td><td className="r" style={{ color: "var(--good)" }}>{fmt(pa.adicP)}</td><td className="r" style={{ color: "var(--warn)" }}>{fmt(pa.adicS)}</td></tr>
      </tbody></table></div>

    {pa.sinC > 0.005 && (<div className="ec-block"><div className="ec-head"><span>Sin asignación</span><span className="amt">Bs {fmt(pa.sinC)}</span></div>
      <table className="ectable"><thead><tr><th>Concepto</th><th className="r">Cotizado</th><th className="r">Contratado</th><th className="r">Margen</th></tr></thead><tbody>
        <tr><td style={{ fontWeight: 600 }}>{pa.sinItems} ítem(s) sin contratista</td><td className="r">{fmt(pa.sinCot)}</td><td className="r">{fmt(pa.sinC)}</td><td className="r" style={{ color: "var(--good)" }}>{fmt(pa.sinCot - pa.sinC)}</td></tr>
      </tbody></table></div>)}

    <div className="ec-block"><div className="ec-head"><span>Resumen por contratista</span></div>
      <table className="ectable"><thead><tr><th>Contratista</th><th className="r">Cotizado</th><th className="r">Contratado</th><th className="r">Margen</th><th className="r">Pagado</th><th className="r">Saldo</th></tr></thead><tbody>
        {pa.rows.map((r, i) => (<tr key={i}><td style={{ fontWeight: 600, color: r.none ? "var(--warn)" : undefined }}>{r.nombre}</td><td className="r" style={{ color: "var(--muted)" }}>{fmt(r.cotizado)}</td><td className="r">{fmt(r.contratado)}</td><td className="r" style={{ color: r.margen >= -0.005 ? "var(--good)" : "var(--bad)" }}>{fmt(r.margen)}</td><td className="r" style={{ color: "var(--good)" }}>{fmt(r.pagado)}</td><td className="r" style={{ color: r.saldo > 0.005 ? "var(--warn)" : "var(--ink)" }}>{fmt(r.saldo)}</td></tr>))}
        <tr className="tot"><td>Total</td><td className="r">{fmt(pa.cotBase)}</td><td className="r">{fmt(pa.contrBase)}</td><td className="r">{fmt(pa.margen)}</td><td className="r">{fmt(pa.princP)}</td><td className="r">{fmt(pa.princS)}</td></tr>
      </tbody></table></div>
  </>);
}

/* ---------- Orden de compra (documento) ---------- */
function OCDocument({ rec, editable, onCode, onFecha, onPlazo }) {
  const logo = rec.logo || DEFAULT_LOGO;
  const info = rec.contractorInfo || {};
  const principal = (rec.principal || []).filter((x) => x.contratado > 0.005);
  const adicionales = (rec.adicionales || []).filter((x) => num(x.monto) > 0.005 || (x.descripcion || "").trim());
  const totalP = principal.reduce((a, x) => a + x.contratado, 0);
  const totalA = adicionales.reduce((a, x) => a + num(x.monto), 0);
  const total = totalP + totalA;
  return (<div className="client">
    <div className="tb-top" style={{ borderRadius: 0 }}>
      <div className="logo-box"><img className="logo-img" src={logo} alt="logo" /></div>
      <div style={{ flex: 1 }}><h1>ORDEN DE COMPRA</h1><div className="sub">Contratación / adjudicación</div></div>
      <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "#AEB8CA" }}>
        {editable
          ? <input value={rec.codigo} onChange={(e) => onCode(e.target.value)} style={{ background: "#3A3B3B", border: "1px solid #4E4F4F", color: "#fff", borderRadius: 4, padding: "3px 6px", fontFamily: "var(--mono)", fontSize: 11, width: 170, textAlign: "right" }} />
          : <div style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>{rec.codigo}</div>}
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--line)" }}>
      <div style={{ padding: "10px 12px", borderRight: "1px solid var(--line)" }}>
        <div className="lbl">Proveedor / Contratista</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{info.nombre || info.razonSocial || rec.contractorName || "—"}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginTop: 3 }}>
          {info.razonSocial && <>Razón social: {info.razonSocial}<br /></>}
          {info.nit && <>NIT: {info.nit}<br /></>}
          {info.contacto && <>Tel: {info.contacto}<br /></>}
          {info.correo && <>{info.correo}</>}
        </div>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div className="lbl">Proyecto</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{rec.proyectoNombre || "—"}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginTop: 3 }}>
          {rec.ubicacion && <>{rec.ubicacion}<br /></>}
          Cotización: {rec.proyectoCodigo}
        </div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--line)" }}>
      <div style={{ padding: "10px 12px", borderRight: "1px solid var(--line)" }}>
        <div className="lbl">Fecha de adjudicación</div>
        {editable ? <input className="fld" type="date" value={rec.fechaAdj || ""} onChange={(e) => onFecha(e.target.value)} style={{ maxWidth: 180 }} /> : <div style={{ fontWeight: 600, fontSize: 13 }}>{rec.fechaAdj || "—"}</div>}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div className="lbl">Plazo de entrega</div>
        {editable ? <input className="fld" value={rec.plazo || ""} placeholder="Ej. 15 días calendario" onChange={(e) => onPlazo(e.target.value)} /> : <div style={{ fontWeight: 600, fontSize: 13 }}>{rec.plazo || "—"}</div>}
      </div>
    </div>
    {rec.formaPago && (<div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
      <div className="lbl">Forma de pago acordada</div><div style={{ fontWeight: 600, fontSize: 13 }}>{rec.formaPago}</div>
    </div>)}

    <table className="ctable">
      <thead><tr><th style={{ width: 34 }}>Ítem</th><th>Descripción</th><th>Unid.</th><th className="r">Cant.</th><th className="r">P.U. Bs</th><th className="r">Subtotal Bs</th></tr></thead>
      <tbody>
        <tr className="csec"><td colSpan={6}>Contrato principal</td></tr>
        {principal.length === 0 && <tr><td colSpan={6} style={{ color: "var(--muted)" }}>Sin ítems de contrato principal.</td></tr>}
        {principal.map((x, i) => (<tr key={i}><td className="mono" style={{ color: "var(--muted)" }}>{x.no}</td><td>{x.descripcion || "—"}</td><td>{x.unidad}</td><td className="r">{fmt(x.qReal)}</td><td className="r">{fmt(x.pReal)}</td><td className="r">{fmt(x.contratado)}</td></tr>))}
        <tr className="csub"><td colSpan={5}>Subtotal contrato principal</td><td className="r">{fmt(totalP)}</td></tr>
        {adicionales.length > 0 && (<>
          <tr className="csec"><td colSpan={6}>Adicionales</td></tr>
          {adicionales.map((x, i) => (<tr key={"a" + i}><td className="mono" style={{ color: "var(--muted)" }}>A{i + 1}</td><td>{x.descripcion || "—"}</td><td></td><td className="r">{fmt(num(x.cantidad))}</td><td className="r">{fmt(num(x.pu))}</td><td className="r">{fmt(num(x.monto))}</td></tr>))}
          <tr className="csub"><td colSpan={5}>Subtotal adicionales</td><td className="r">{fmt(totalA)}</td></tr>
        </>)}
        <tr className="cgrand"><td colSpan={5}>TOTAL CONTRATADO</td><td className="r">Bs {fmt(total)}</td></tr>
      </tbody>
    </table>
    <div style={{ padding: "12px 14px", fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>Precios en bolivianos, con factura (IVA incluido). Montos a costo real contratado.</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "22px 20px 20px" }}>
      <div style={{ textAlign: "center" }}>
        {rec.firmante && rec.firmante.firma ? <img src={rec.firmante.firma} alt="firma" style={{ height: 46, objectFit: "contain", marginBottom: 2 }} /> : <div style={{ height: 34 }} />}
        <div style={{ borderTop: "1px solid var(--ink)", paddingTop: 6, fontSize: 11.5 }}><b>{rec.firmante && (rec.firmante.nombre || rec.firmante.apellidos) ? ((rec.firmante.nombre || "") + " " + (rec.firmante.apellidos || "")).trim() : "ORIGINA GROUP S.R.L."}</b>{rec.firmante && rec.firmante.cargo ? <div style={{ color: "var(--ink2)", fontSize: 11, marginTop: 2 }}>{rec.firmante.cargo}</div> : null}<div style={{ color: "var(--ink2)", fontSize: 10.5, fontWeight: 700, marginTop: 4 }}>ORIGINA GROUP S.R.L.</div><div style={{ color: "var(--muted)", fontSize: 10 }}>{(rec.firmante && rec.firmante.email) || guessMail(rec.firmante && rec.firmante.nombre) || "contacto@origina-group.com"}</div></div>
      </div>
      <div style={{ textAlign: "center", alignSelf: "end" }}><div style={{ height: 34 }} /><div style={{ borderTop: "1px solid var(--ink)", paddingTop: 6, fontSize: 11.5 }}>Aceptado — {info.nombre || info.razonSocial || rec.contractorName || "Proveedor"}</div></div>
    </div>
  </div>);
}

/* ---------- Repositorio de OC emitidas ---------- */
function OCRepo({ ordenes, onOpen, onDelete }) {
  const [q, setQ] = useState(""); const [ctFilter, setCtFilter] = useState("");
  const contractors = [...new Set(ordenes.map((o) => o.contractorName))].sort();
  const ql = norm(q);
  const list = ordenes.filter((o) => {
    if (ctFilter && o.contractorName !== ctFilter) return false;
    if (!ql) return true;
    const hay = [o.codigo, o.contractorName, o.proyectoNombre, o.proyectoCodigo, o.fechaAdj, ...(o.principal || []).map((x) => x.descripcion), ...(o.adicionales || []).map((x) => x.descripcion)].join(" ");
    return norm(hay).includes(ql);
  });
  return (<>
    <div className="crep" style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        <input className="fld" style={{ flex: 1, minWidth: 160 }} value={q} placeholder="Buscar por código, contratista, ítem, fecha…" onChange={(e) => setQ(e.target.value)} />
        <select className="psel" value={ctFilter} onChange={(e) => setCtFilter(e.target.value)}><option value="">Todos los contratistas</option>{contractors.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </div>
    </div>
    {list.length === 0 ? <div className="crep"><div className="empty">{ordenes.length === 0 ? "Aún no has emitido órdenes de compra. Genera una desde un contratista." : "Sin resultados para el filtro."}</div></div>
      : list.map((o) => { const pagado = (o.pagos || []).reduce((a, p) => a + num(p.monto), 0); const saldo = o.total - pagado; return (<div className="crep" key={o.id} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }} onClick={() => onOpen(o)}>
          <FileText size={18} color="var(--accent-ink)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "var(--mono)" }}>{o.codigo}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{o.contractorName} · {o.proyectoNombre || o.proyectoCodigo} · {o.fechaAdj}</div>
          </div>
          <div style={{ textAlign: "right" }}><div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13 }}>Bs {fmt(o.total)}</div>{pagado > 0.005 && <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: saldo > 0.005 ? "var(--warn)" : "var(--good)" }}>Saldo Bs {fmt(saldo)}</div>}</div>
          <button className="iconbtn" onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar esta OC del repositorio?")) onDelete(o.id); }}><Trash2 size={15} /></button>
        </div>
      </div>); })}
  </>);
}

function ClientView({ meta, sections, params, totals, disc, firmante, cierre }) {
  const usd = meta.moneda === "US$"; const rate = usd ? (num(meta.tcCliente) || params.tcOficial || 1) : 1; const sym = usd ? "US$" : "Bs";
  const M = (x) => sym + " " + fmt(x / rate);
  const cz = cierre && cierre.activo ? cierre : null;
  const fPror = cz && cz.modo === "prorrateado" ? cz.factor : 1;   // prorratea en los PU mostrados
  const mD = (disc ? disc.mDisc : 1) * fPror;
  const logo = meta.logo || DEFAULT_LOGO;
  const labA = meta.grupoALabel || "Arquitectura", labB = meta.grupoBLabel || "Ingenierías", labC = meta.grupoCLabel || "Terceros";
  const aSecs = sections.filter((s) => s.grupo !== "B" && s.grupo !== "C"), bSecs = sections.filter((s) => s.grupo === "B"), cSecs = sections.filter((s) => s.grupo === "C");
  const nonC = sections.filter((s) => s.grupo !== "C");
  const both = totals.grpA > 0.005 && totals.grpB > 0.005;
  const hasC = totals.grpC > 0.005, hasDisc = disc && disc.hasDisc;
  const ourFinal = cz ? cz.cierreBs : totals.total, totalInv = ourFinal + totals.grpC;
  let n = 0;
  const renderSec = (sec) => {
    n++; const si = n; const st = sec.items.reduce((a, it) => a + computeItem(it, params).total, 0) * mD;
    return (<React.Fragment key={sec.id}>
      <tr className="csec"><td>{si}.0</td><td colSpan={4}>{sec.nombre}</td><td className="r">{fmt(st / rate)}</td></tr>
      {sec.items.map((it, ii) => { const c = computeItem(it, params); return (<tr key={it.id}><td className="mono" style={{ color: "var(--muted)" }}>{si}.{ii + 1}</td><td>{it.descripcion || "—"}</td><td>{it.unidad}</td><td className="r">{fmt(c.cant)}</td><td className="r">{fmt(c.puVenta * mD / rate)}</td><td className="r">{fmt(c.total * mD / rate)}</td></tr>); })}
    </React.Fragment>);
  };
  const renderCSec = (sec) => {
    n++; const si = n; const st = sec.items.reduce((a, it) => a + num(it.monto), 0);
    return (<React.Fragment key={sec.id}>
      <tr className="csec"><td>{si}.0</td><td colSpan={4}>{sec.nombre}</td><td className="r">{fmt(st / rate)}</td></tr>
      {sec.items.map((it, ii) => (<tr key={it.id}><td className="mono" style={{ color: "var(--muted)" }}>{si}.{ii + 1}</td><td colSpan={4}>{it.descripcion || "—"}</td><td className="r">{fmt(num(it.monto) / rate)}</td></tr>))}
    </React.Fragment>);
  };
  return (<div className="client">
    <div style={{ background: "#fff", padding: "22px 24px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", color: "var(--accent)", textTransform: "uppercase" }}>{meta.esAdicional ? "Servicios adicionales" : "Presupuesto de obra"}</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", margin: "5px 0 0", lineHeight: 1.05, letterSpacing: "-.3px" }}>{meta.proyecto || meta.cliente || "Cotización"}</h1>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <img src={logo} alt="ORIGINA GROUP" style={{ height: 24, width: "auto", maxWidth: 240, objectFit: "contain", display: "inline-block" }} />
          <div style={{ marginTop: 11, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>{meta.codigo}{meta.version ? " · V" + String(meta.version).padStart(2, "0") : ""}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{meta.fecha}</div>
        </div>
      </div>
      <div style={{ borderTop: "2.5px solid var(--ink)", marginTop: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 1fr", gap: 1, background: "var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ background: "#fff", padding: "9px 12px 9px 0" }}><div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".8px", color: "var(--muted)", textTransform: "uppercase" }}>Cliente</div><div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, marginTop: 2 }}>{meta.cliente || "—"}</div></div>
        <div style={{ background: "#fff", padding: "9px 12px" }}><div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".8px", color: "var(--muted)", textTransform: "uppercase" }}>Ubicación</div><div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 2 }}>{meta.ubicacion || "—"}</div></div>
        <div style={{ background: "#fff", padding: "9px 0 9px 12px" }}><div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".8px", color: "var(--muted)", textTransform: "uppercase" }}>Superficie</div><div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 2 }}>{meta.superficie ? (/^[\d.,\s]+$/.test(String(meta.superficie).trim()) ? meta.superficie + " m²" : meta.superficie) : "—"}</div></div>
      </div>
    </div>
    {meta.esAdicional && <div style={{ background: "var(--accent-soft)", borderBottom: "1px solid #BFE0E3", padding: "8px 14px", fontSize: 12, color: "var(--accent-ink)" }}><b>Orden Comercial de Servicios ADICIONAL</b> — complementaria y vinculada a la oferta principal <b>{meta.parentCodigo}</b> del proyecto.</div>}
    <table className="ctable">
      <thead><tr><th style={{ width: 34 }}>Ítem</th><th>Descripción</th><th>Unid.</th><th className="r">Cant.</th><th className="r">P.U. {sym}</th><th className="r">Total {sym}</th></tr></thead>
      <tbody>
        {both ? (<>
          <tr className="cgroup a"><td colSpan={5}>GRUPO A · {labA.toUpperCase()}</td><td className="r">{M(totals.grpA * mD)}</td></tr>
          {aSecs.map(renderSec)}
          <tr className="cgroup b"><td colSpan={5}>GRUPO B · {labB.toUpperCase()}</td><td className="r">{M(totals.grpB * mD)}</td></tr>
          {bSecs.map(renderSec)}
        </>) : nonC.map(renderSec)}
        {hasC && (<>
          <tr className="cgroup c"><td colSpan={5}>GRUPO C · {labC.toUpperCase()} · CONTRATACIÓN DIRECTA DEL CLIENTE</td><td className="r">{M(totals.grpC)}</td></tr>
          {cSecs.map(renderCSec)}
        </>)}
      </tbody>
    </table>

    <div className="grpsummary">
      {both && (<>
        <div className="gsr"><span><i className="dot" style={{ background: "var(--accent)" }} />Subtotal A · {labA}</span><b>{M(totals.grpA * mD)}</b></div>
        <div className="gsr"><span><i className="dot" style={{ background: "var(--ink)" }} />Subtotal B · {labB}</span><b>{M(totals.grpB * mD)}</b></div>
      </>)}
      {hasDisc && (<>
        <div className="gsr"><span>Subtotal</span><b>{M(totals.total * mD)}</b></div>
        {disc.items.map((x) => <div className="gsr disc" key={x.id}><span>{x.nombre || "Descuento"}{x.tipo === "pct" ? ` (${fmt(num(x.valor))}%)` : ""}</span><b>− {M(x.montoBs)}</b></div>)}
      </>)}
      {cz && cz.modo === "visible" && cz.descBs > 0.005 && (<>
        <div className="gsr"><span>Subtotal</span><b>{M(cz.listaBs)}</b></div>
        <div className="gsr disc"><span>Descuento comercial ({fmt(cz.pct)}%)</span><b>− {M(cz.descBs)}</b></div>
      </>)}
      {(hasC || hasDisc || cz) && (<div className={"gsr" + (hasC ? " sub" : " tot")}><span>{hasC ? (both ? "TOTAL A + B (Origina Group SRL)" : "TOTAL (Origina Group SRL)") : "PRECIO FINAL"}</span><b>{M(ourFinal)}</b></div>)}
      {hasC && (<>
        <div className="gsr terceros"><span><i className="dot" style={{ background: "#8A6D3B" }} />Subtotal C · {labC}</span><b>{M(totals.grpC)}</b></div>
        <div className="gsr tot"><span>TOTAL INVERSIÓN</span><b>{M(totalInv)}</b></div>
      </>)}
      {!hasC && !hasDisc && !cz && (<div className="gsr tot"><span>{both ? "TOTAL A + B (Origina Group SRL)" : "TOTAL GENERAL"}</span><b>{M(ourFinal)}</b></div>)}
    </div>

    {cz && cz.modo === "visible" && cz.descBs > 0.005 && (<div className="grpnote"><div><i className="dot" style={{ background: "var(--accent)" }} /><b>Sobre el descuento otorgado:</b> aplica proporcionalmente a todas las partidas de la presente oferta. Cualquier adicional o deductivo se valorará aplicando el mismo factor.</div></div>)}
    {(both || hasC) && (<div className="grpnote">
      {both && <div><i className="dot" style={{ background: "var(--accent)" }} /><b>Grupo A · {labA}:</b> partidas personalizables. Se pueden ajustar acabados, materiales y alcances según preferencia y presupuesto.</div>}
      {both && <div><i className="dot" style={{ background: "var(--ink)" }} /><b>Grupo B · {labB}:</b> partidas técnicas de instalaciones e ingenierías. De ellas depende el correcto funcionamiento de la oficina, por lo que su margen de ajuste es limitado.</div>}
      {hasC && <div><i className="dot" style={{ background: "#8A6D3B" }} /><b>Grupo C · {labC}:</b> valores referenciales de proveedores para contratación directa del cliente. Se incluyen solo para dar visibilidad de la inversión total; no forman parte de nuestra oferta contractual.</div>}
    </div>)}
    {(meta.pagos || []).filter((h) => (h.detalle || "").trim() || num(h.pct) > 0).length > 0 && (<div className="fp-client">
      <div className="fp-title">FORMA DE PAGO</div>
      <table className="ctable"><thead><tr><th style={{ width: 34 }}>N°</th><th>Detalle</th><th className="r" style={{ width: 70 }}>%</th><th className="r" style={{ width: 130 }}>Monto {sym}</th></tr></thead>
        <tbody>
          {(meta.pagos || []).filter((h) => (h.detalle || "").trim() || num(h.pct) > 0).map((h, i) => (
            <tr key={h.id}><td className="mono" style={{ color: "var(--muted)" }}>{i + 1}</td><td>{h.detalle || "—"}</td><td className="r mono">{fmt(num(h.pct))}%</td><td className="r mono">{fmt(ourFinal * num(h.pct) / 100 / rate)}</td></tr>))}
          {(() => { const sum = (meta.pagos || []).reduce((a, x) => a + num(x.pct), 0); return (<tr className="fp-tot"><td></td><td><b>TOTAL</b></td><td className="r mono"><b>{fmt(sum)}%</b></td><td className="r mono"><b>{fmt(ourFinal * sum / 100 / rate)}</b></td></tr>); })()}
        </tbody>
      </table>
      <div className="fp-note">Los pagos se realizarán mediante cheque o transferencia bancaria{meta.moneda === "US$" ? ", al tipo de cambio oficial vigente en el momento del pago" : ""}.</div>
    </div>)}
    {firmante && (firmante.firma || firmante.nombre) && <div style={{ marginTop: 28 }}><FirmaBlock firmante={firmante} /></div>}
  </div>);
}
